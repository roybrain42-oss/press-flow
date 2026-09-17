import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { db, PrintJobOption } from '../db';
import { uploadMiddleware, serveSecureDocument } from '../storage';
import { calculateServerDocumentPages, analyzeServerDocumentPages } from '../utils/pageCounter';

const router = Router();

// GET /api/public/db-status (Public database status & health)
router.get('/db-status', async (_req: Request, res: Response) => {
  try {
    const info = await db.getDatabaseInfo();
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get DB status' });
  }
});

// GET /api/public/presses (List active presses for discovery / demo selector)
router.get('/presses', (_req: Request, res: Response) => {
  const tenants = db.getTenants().filter((t) => t.status === 'active');
  const sanitized = tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    location: t.location,
    address: t.address,
    description: t.description,
    logo_url: t.logo_url,
    operating_hours: t.settings.operating_hours,
  }));
  res.json(sanitized);
});

// GET /api/public/press/:slug (Public profile for customer QR scan)
router.get('/press/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const tenant = db.getTenantBySlug(slug);

  if (!tenant) {
    res.status(404).json({ error: 'Printing press not found.' });
    return;
  }

  if (tenant.status === 'pending_approval') {
    res.status(403).json({
      error: 'This printing press registration is currently pending platform approval.',
      status: 'pending_approval',
    });
    return;
  }

  if (tenant.status === 'suspended') {
    res.status(403).json({
      error: 'This printing press is temporarily unavailable.',
      status: 'suspended',
    });
    return;
  }

  const services = db.getServices(tenant.id).filter((s) => s.is_active);

  res.json({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    location: tenant.location,
    address: tenant.address,
    phone: tenant.phone,
    email: tenant.email,
    description: tenant.description,
    logo_url: tenant.logo_url,
    settings: {
      currency: tenant.settings.currency || 'GHS',
      currency_symbol: tenant.settings.currency_symbol || 'GH₵',
      operating_hours: tenant.settings.operating_hours,
      pay_at_shop_enabled: tenant.settings.pay_at_shop_enabled ?? true,
      online_payment_enabled: tenant.settings.online_payment_enabled ?? true,
      payment_provider: tenant.settings.payment_provider || 'paystack',
      max_file_size_mb: tenant.settings.max_file_size_mb || 25,
      contact_whatsapp: tenant.settings.contact_whatsapp,
      allow_notes: tenant.settings.allow_notes ?? true,
    },
    services,
  });
});

// GET /api/public/press/:slug/qr (Generate QR Code image for the printing press)
router.get('/press/:slug/qr', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const tenant = db.getTenantBySlug(slug);

  if (!tenant) {
    res.status(404).json({ error: 'Printing press not found.' });
    return;
  }

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const publicUrl = `${protocol}://${host}/p/${tenant.slug}`;

  try {
    const format = req.query.format === 'svg' ? 'svg' : 'png';

    if (format === 'svg') {
      const svg = await QRCode.toString(publicUrl, {
        type: 'svg',
        color: { dark: '#0F172A', light: '#FFFFFF' },
        margin: 2,
      });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
      return;
    }

    // Default: PNG Data URL or image
    if (req.query.download === 'true') {
      const buffer = await QRCode.toBuffer(publicUrl, {
        type: 'png',
        width: 800,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${tenant.slug}-qr-code.png"`);
      res.send(buffer);
      return;
    }

    const dataUrl = await QRCode.toDataURL(publicUrl, {
      width: 500,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });

    res.json({
      publicUrl,
      dataUrl,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
    });
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

// Helper for dynamic price calculation based on tenant's configured pricing
function calculateJobPrice(
  tenantId: string,
  options: {
    copies: number;
    paper_size: 'A4' | 'A3' | 'A5' | 'Letter';
    color_mode: 'bw' | 'color' | 'mixed';
    page_count: number;
    color_pages?: number;
    bw_pages?: number;
    binding?: string;
    lamination?: string;
    finishing_services: string[];
  }
): { total: number; breakdown: Array<{ item: string; amount: number }> } {
  const services = db.getServices(tenantId);
  const breakdown: Array<{ item: string; amount: number }> = [];

  const copies = Math.max(1, Number(options.copies) || 1);
  const pageCount = Math.max(1, Number(options.page_count) || 1);
  const paperSize = options.paper_size || 'A4';
  const colorMode = options.color_mode || 'bw';

  // Find matching base print service in tenant's configured catalog for B&W
  let bwPricePerPage = paperSize === 'A3' ? 1.00 : 0.50;
  const matchedBwService = services.find((s) => {
    if (!s.is_active || s.category !== 'printing') return false;
    const name = s.name.toLowerCase();
    const hasBwMatch = name.includes('b&w') || name.includes('black') || name.includes('monochrome');
    const hasSizeMatch = name.includes(paperSize.toLowerCase());
    return hasBwMatch && hasSizeMatch;
  }) || services.find((s) => {
    if (!s.is_active || s.category !== 'printing') return false;
    const name = s.name.toLowerCase();
    return name.includes('b&w') || name.includes('black') || name.includes('monochrome');
  });
  if (matchedBwService) {
    bwPricePerPage = matchedBwService.price;
  }

  // Find matching base print service in tenant's configured catalog for Colour
  let colorPricePerPage = paperSize === 'A3' ? 4.00 : 2.00;
  const matchedColorService = services.find((s) => {
    if (!s.is_active || s.category !== 'printing') return false;
    const name = s.name.toLowerCase();
    const hasColorMatch = name.includes('colour') || name.includes('color');
    const hasSizeMatch = name.includes(paperSize.toLowerCase());
    return hasColorMatch && hasSizeMatch;
  }) || services.find((s) => {
    if (!s.is_active || s.category !== 'printing') return false;
    const name = s.name.toLowerCase();
    return name.includes('colour') || name.includes('color');
  });
  if (matchedColorService) {
    colorPricePerPage = matchedColorService.price;
  }

  // Calculate printing costs based on mode and color/bw page counts
  if (colorMode === 'bw') {
    const printTotal = bwPricePerPage * pageCount * copies;
    breakdown.push({
      item: `Printing: ${paperSize} Black & White (${pageCount} pgs × ${copies} ${copies === 1 ? 'copy' : 'copies'} @ GH₵${bwPricePerPage.toFixed(2)}/pg)`,
      amount: printTotal,
    });
  } else if (colorMode === 'color') {
    const printTotal = colorPricePerPage * pageCount * copies;
    breakdown.push({
      item: `Printing: ${paperSize} Full Colour (${pageCount} pgs × ${copies} ${copies === 1 ? 'copy' : 'copies'} @ GH₵${colorPricePerPage.toFixed(2)}/pg)`,
      amount: printTotal,
    });
  } else {
    // 'mixed' mode: auto-smart price based on actual count of coloured and non-coloured pages
    const numColor = Math.max(0, options.color_pages ?? 0);
    const numBw = Math.max(0, options.bw_pages !== undefined ? options.bw_pages : (pageCount - numColor));

    if (numColor > 0) {
      const colorTotal = colorPricePerPage * numColor * copies;
      breakdown.push({
        item: `Printing: ${paperSize} Colour (${numColor} pgs × ${copies} ${copies === 1 ? 'copy' : 'copies'} @ GH₵${colorPricePerPage.toFixed(2)}/pg)`,
        amount: colorTotal,
      });
    }

    if (numBw > 0) {
      const bwTotal = bwPricePerPage * numBw * copies;
      breakdown.push({
        item: `Printing: ${paperSize} Black & White (${numBw} pgs × ${copies} ${copies === 1 ? 'copy' : 'copies'} @ GH₵${bwPricePerPage.toFixed(2)}/pg)`,
        amount: bwTotal,
      });
    }

    // Edge case where both are 0
    if (numColor === 0 && numBw === 0) {
      const fallbackTotal = bwPricePerPage * pageCount * copies;
      breakdown.push({
        item: `Printing: ${paperSize} (${pageCount} pgs × ${copies} ${copies === 1 ? 'copy' : 'copies'} @ GH₵${bwPricePerPage.toFixed(2)}/pg)`,
        amount: fallbackTotal,
      });
    }
  }

  // Binding fee
  if (options.binding && options.binding !== 'none') {
    let bindingFee = 0;
    const bindingService = services.find((s) => {
      const name = s.name.toLowerCase();
      if (options.binding === 'hardcover') return name.includes('thesis') || name.includes('hardcover');
      if (options.binding === 'spiral') return name.includes('spiral') || name.includes('comb');
      if (options.binding === 'staple') return name.includes('staple');
      return false;
    });

    if (bindingService) {
      bindingFee = bindingService.price * copies;
    } else {
      if (options.binding === 'hardcover') bindingFee = 45.00 * copies;
      else if (options.binding === 'spiral') bindingFee = 8.00 * copies;
      else if (options.binding === 'staple') bindingFee = 0.50 * copies;
    }

    if (bindingFee > 0) {
      breakdown.push({
        item: `Binding: ${options.binding.charAt(0).toUpperCase() + options.binding.slice(1)} (${copies} document${copies > 1 ? 's' : ''})`,
        amount: bindingFee,
      });
    }
  }

  // Lamination fee
  if (options.lamination && options.lamination !== 'none') {
    let laminationFee = 0;
    const laminationService = services.find((s) => s.name.toLowerCase().includes('lamination'));
    const perItem = laminationService ? laminationService.price : 5.00;
    laminationFee = perItem * copies;

    breakdown.push({
      item: `Lamination: ${options.lamination.charAt(0).toUpperCase() + options.lamination.slice(1)} (${copies} item${copies > 1 ? 's' : ''})`,
      amount: laminationFee,
    });
  }

  // Any additional selected finishing services
  if (Array.isArray(options.finishing_services)) {
    for (const serviceId of options.finishing_services) {
      const service = services.find((s) => s.id === serviceId);
      if (service && service.is_active) {
        let serviceFee = service.price;
        if (service.unit_type === 'per_copy' || service.unit_type === 'per_document' || service.unit_type === 'per_item') {
          serviceFee = service.price * copies;
        } else if (service.unit_type === 'per_page') {
          serviceFee = service.price * pageCount * copies;
        }
        breakdown.push({
          item: service.name,
          amount: serviceFee,
        });
      }
    }
  }

  const grandTotal = breakdown.reduce((sum, b) => sum + b.amount, 0);
  return {
    total: Math.max(0.5, Number(grandTotal.toFixed(2))),
    breakdown,
  };
}

// POST /api/public/press/:slug/price-estimate (Calculate estimated price before submission)
router.post('/press/:slug/price-estimate', (req: Request, res: Response) => {
  const { slug } = req.params;
  const tenant = db.getTenantBySlug(slug);

  if (!tenant) {
    res.status(404).json({ error: 'Printing press not found.' });
    return;
  }

  const result = calculateJobPrice(tenant.id, req.body);
  res.json(result);
});

// POST /api/public/press/:slug/upload (Customer submits document and options)
router.post(
  '/press/:slug/upload',
  uploadMiddleware.single('document'),
  async (req: Request, res: Response) => {
    const { slug } = req.params;
    const tenant = db.getTenantBySlug(slug);

    if (!tenant) {
      res.status(404).json({ error: 'Printing press not found.' });
      return;
    }

    if (tenant.status !== 'active') {
      res.status(403).json({ error: 'This printing press is not accepting submissions.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Please select a document to upload.' });
      return;
    }

    const {
      customer_name,
      customer_phone,
      customer_email,
      copies = '1',
      paper_size = 'A4',
      color_mode = 'bw',
      sidedness = 'single',
      orientation = 'portrait',
      page_range = 'All',
      page_count = '1',
      binding = 'none',
      lamination = 'none',
      finishing_services = '[]',
      additional_instructions = '',
      payment_method = 'shop',
      fulfillment_type = 'instant_counter',
      pickup_time = '',
      is_pickup = 'false',
    } = req.body;

    // Calculate actual total number of pages and color analysis from uploaded document
    const docAnalysis = await analyzeServerDocumentPages(req.file.path);
    const clientSpecifiedPages = parseInt(page_count, 10);
    const finalPageCount = (!isNaN(clientSpecifiedPages) && clientSpecifiedPages > 0)
      ? clientSpecifiedPages
      : Math.max(1, docAnalysis.totalPages);

    const reqColorPages = req.body.color_pages !== undefined ? parseInt(req.body.color_pages, 10) : undefined;
    const reqBwPages = req.body.bw_pages !== undefined ? parseInt(req.body.bw_pages, 10) : undefined;

    let finalColorPages = 0;
    let finalBwPages = finalPageCount;

    if (color_mode === 'color') {
      finalColorPages = finalPageCount;
      finalBwPages = 0;
    } else if (color_mode === 'bw') {
      finalColorPages = 0;
      finalBwPages = finalPageCount;
    } else {
      // 'mixed' mode
      finalColorPages = (!isNaN(reqColorPages!) && reqColorPages! >= 0)
        ? reqColorPages!
        : docAnalysis.colorPages;
      finalBwPages = (!isNaN(reqBwPages!) && reqBwPages! >= 0)
        ? reqBwPages!
        : Math.max(0, finalPageCount - finalColorPages);
    }

    // Pickup & Customer details are optional for walk-in / instant submissions
    const finalCustomerName = (customer_name && String(customer_name).trim()) || 'Walk-in Customer';
    const finalCustomerPhone = (customer_phone && String(customer_phone).trim()) || undefined;
    const isPickupSelected = is_pickup === 'true' || is_pickup === true || fulfillment_type === 'pickup';
    const finalPickupTime = pickup_time && String(pickup_time).trim() ? String(pickup_time).trim() : undefined;

    let parsedFinishing: string[] = [];
    try {
      parsedFinishing = JSON.parse(finishing_services);
    } catch {
      parsedFinishing = [];
    }

    const options: PrintJobOption = {
      copies: parseInt(copies, 10) || 1,
      paper_size: (paper_size as any) || 'A4',
      color_mode: (color_mode as any) || 'bw',
      sidedness: (sidedness as any) || 'single',
      orientation: (orientation as any) || 'portrait',
      page_range: page_range || 'All',
      page_count: finalPageCount,
      color_pages: finalColorPages,
      bw_pages: finalBwPages,
      detected_pages: docAnalysis.totalPages,
      detected_color_pages: docAnalysis.colorPages,
      detected_bw_pages: docAnalysis.bwPages,
      binding: (binding as any) || 'none',
      lamination: (lamination as any) || 'none',
      finishing_services: parsedFinishing,
      additional_instructions: additional_instructions ? String(additional_instructions).trim() : undefined,
      fulfillment_type: isPickupSelected ? 'pickup' : 'instant_counter',
      pickup_time: finalPickupTime,
      is_pickup: isPickupSelected,
    };

    // Calculate price
    const { total } = calculateJobPrice(tenant.id, options);

    // Generate unique Job Number and secure tracking token
    const jobNumber = db.generateJobNumber();
    const trackingToken = `trk-${uuidv4().substring(0, 12)}`;

    // Create Document record
    const documentRecord = db.createDocument({
      tenant_id: tenant.id,
      job_id: '', // will link right below
      original_name: req.file.originalname,
      stored_filename: req.file.filename,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      storage_path: req.file.path,
      download_token: `dl-${uuidv4()}`,
      expires_at: new Date(Date.now() + (tenant.settings.document_retention_days || 30) * 86400000).toISOString(),
    });

    // Create PrintJob
    const printJob = db.createPrintJob({
      job_number: jobNumber,
      tenant_id: tenant.id,
      customer_name: finalCustomerName,
      customer_phone: finalCustomerPhone,
      customer_email: customer_email ? String(customer_email).trim() : undefined,
      tracking_token: trackingToken,
      document_id: documentRecord.id,
      document_name: req.file.originalname,
      document_size: req.file.size,
      document_mime: req.file.mimetype,
      options,
      estimated_total: total,
      payment_status: payment_method === 'online' ? 'pending' : 'pay_at_shop',
      payment_method: payment_method === 'online' ? 'online' : 'shop',
      job_status: 'pending',
      status_notes: isPickupSelected && finalPickupTime
        ? `Job received. Customer scheduled optional pickup for ${finalPickupTime}.`
        : 'Job received via digital QR upload. Awaiting press confirmation.',
      fulfillment_type: isPickupSelected ? 'pickup' : 'instant_counter',
      pickup_time: finalPickupTime,
    });

    // Update document with created job ID
    documentRecord.job_id = printJob.id;

    // Log audit action
    db.addAuditLog({
      tenant_id: tenant.id,
      action: 'JOB_SUBMITTED_BY_CUSTOMER',
      resource_type: 'job',
      resource_id: printJob.id,
      details: {
        job_number: jobNumber,
        customer_name,
        customer_phone,
        total,
        payment_method,
      },
      ip: req.ip,
    });

    res.status(201).json({
      message: 'Print job submitted successfully!',
      job: {
        id: printJob.id,
        job_number: printJob.job_number,
        tracking_token: printJob.tracking_token,
        customer_name: printJob.customer_name,
        customer_phone: printJob.customer_phone,
        document_name: printJob.document_name,
        estimated_total: printJob.estimated_total,
        payment_status: printJob.payment_status,
        payment_method: printJob.payment_method,
        job_status: printJob.job_status,
        created_at: printJob.created_at,
        tenant_name: tenant.name,
        tenant_location: tenant.location,
      },
    });
  }
);

// GET /api/public/track/:jobNumber (Customer tracks job status without account)
router.get('/track/:jobNumber', (req: Request, res: Response) => {
  const { jobNumber } = req.params;
  const token = req.query.token as string;

  if (!token) {
    res.status(400).json({ error: 'Security tracking token is required to view this print job.' });
    return;
  }

  const job = db.getPrintJobByNumberAndToken(jobNumber, token);
  if (!job) {
    res.status(404).json({ error: 'Print job not found. Please verify your Job Number and tracking link.' });
    return;
  }

  const tenant = db.getTenantById(job.tenant_id);

  res.json({
    job: {
      id: job.id,
      job_number: job.job_number,
      customer_name: job.customer_name,
      document_name: job.document_name,
      options: job.options,
      estimated_total: job.estimated_total,
      payment_status: job.payment_status,
      payment_method: job.payment_method,
      job_status: job.job_status,
      status_notes: job.status_notes,
      created_at: job.created_at,
      completed_at: job.completed_at,
      document_id: job.document_id,
      document_size: job.document_size,
      document_mime: job.document_mime,
      tenant_id: job.tenant_id,
      tracking_token: job.tracking_token,
    },
    press: tenant
      ? {
          name: tenant.name,
          location: tenant.location,
          address: tenant.address,
          phone: tenant.phone,
          operating_hours: tenant.settings.operating_hours,
          contact_whatsapp: tenant.settings.contact_whatsapp,
        }
      : null,
  });
});

// GET /api/public/documents/:docId/download (Customer download via tracking token)
router.get('/documents/:docId/download', (req: Request, res: Response) => {
  const { docId } = req.params;
  const token = req.query.token as string;

  if (!token) {
    res.status(403).json({ error: 'Tracking token required for document download.' });
    return;
  }

  serveSecureDocument(req, res, docId, null, false, token);
});

// POST /api/public/payments/paystack-simulate (Ghanaian Paystack Payment Simulation / Confirmation)
router.post('/payments/paystack-simulate', (req: Request, res: Response) => {
  const { job_id, tracking_token, email } = req.body;

  const job = db.getPrintJobById(job_id);
  if (!job) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }

  if (job.tracking_token !== tracking_token) {
    res.status(403).json({ error: 'Invalid security token for this job.' });
    return;
  }

  const reference = `PSTK_GHA_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  // Record payment
  db.createPayment({
    tenant_id: job.tenant_id,
    job_id: job.id,
    reference,
    amount: job.estimated_total,
    currency: 'GHS',
    status: 'paid',
    provider: 'paystack',
    customer_email: email || job.customer_email || 'customer@printflow.com',
    paid_at: new Date().toISOString(),
  });

  // Update job payment status
  db.updatePrintJob(job.id, null, {
    payment_status: 'paid',
    payment_reference: reference,
    status_notes: `Payment of GH₵${job.estimated_total.toFixed(2)} verified via Paystack Ghana (${reference}).`,
  });

  // Add audit log
  db.addAuditLog({
    tenant_id: job.tenant_id,
    action: 'PAYMENT_VERIFIED',
    resource_type: 'payment',
    resource_id: reference,
    details: {
      amount: job.estimated_total,
      job_number: job.job_number,
      provider: 'paystack',
    },
  });

  res.json({
    success: true,
    message: 'Payment completed successfully!',
    reference,
    amount: job.estimated_total,
  });
});

export default router;
