import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  DollarSign,
  Tag,
  Layers,
  RefreshCw,
  Search,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  X,
  FileText,
  BookmarkPlus,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Service, ServiceUnit } from '../../types';

interface PresetOption {
  name: string;
  category: 'printing' | 'finishing' | 'copying' | 'other';
  unit_type: ServiceUnit;
  defaultPrice: number;
  description: string;
}

const COMMON_PRESETS: PresetOption[] = [
  {
    name: 'A4 Black & White Printing',
    category: 'printing',
    unit_type: 'per_page',
    defaultPrice: 0.50,
    description: 'Standard monochrome 80gsm document printing',
  },
  {
    name: 'A4 Full Colour Laser',
    category: 'printing',
    unit_type: 'per_page',
    defaultPrice: 2.00,
    description: 'Vibrant color print for charts, slides, and flyers',
  },
  {
    name: 'A3 Black & White Printing',
    category: 'printing',
    unit_type: 'per_page',
    defaultPrice: 1.00,
    description: 'Monochrome posters and architectural blueprints',
  },
  {
    name: 'A3 Full Colour Laser',
    category: 'printing',
    unit_type: 'per_page',
    defaultPrice: 4.00,
    description: 'Vibrant high-resolution A3 promotional prints',
  },
  {
    name: 'Spiral / Comb Binding',
    category: 'finishing',
    unit_type: 'per_document',
    defaultPrice: 8.00,
    description: 'Plastic comb or spiral binding with clear transparent cover',
  },
  {
    name: 'Hardcover Thesis Binding',
    category: 'finishing',
    unit_type: 'per_document',
    defaultPrice: 45.00,
    description: 'Embossed hardback thesis/dissertation project binding',
  },
  {
    name: 'Corner Stapling',
    category: 'finishing',
    unit_type: 'per_document',
    defaultPrice: 0.50,
    description: 'Heavy-duty corner staple for exam papers and handouts',
  },
  {
    name: 'A4 Gloss Lamination',
    category: 'finishing',
    unit_type: 'per_item',
    defaultPrice: 5.00,
    description: '125-micron protective heat-seal lamination pouch',
  },
  {
    name: 'A3 Gloss Lamination',
    category: 'finishing',
    unit_type: 'per_item',
    defaultPrice: 10.00,
    description: 'Large protective lamination for signs and certificates',
  },
  {
    name: 'Double-Sided Photocopy',
    category: 'copying',
    unit_type: 'per_page',
    defaultPrice: 0.40,
    description: 'Duplex monochrome document duplication',
  },
  {
    name: 'High-Res Document Scanning',
    category: 'other',
    unit_type: 'per_document',
    defaultPrice: 1.00,
    description: 'Scan document directly to searchable PDF / email',
  },
];

export const ServicesPricingManager: React.FC = () => {
  const { tenant } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Quick Inline Editing State
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlinePriceInput, setInlinePriceInput] = useState<string>('');
  const [inlineLoadingId, setInlineLoadingId] = useState<string | null>(null);

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Form fields for Add / Edit modal
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<'printing' | 'finishing' | 'copying' | 'other'>('printing');
  const [unitType, setUnitType] = useState<ServiceUnit>('per_page');
  const [price, setPrice] = useState<string>('1.00');
  const [description, setDescription] = useState<string>('');

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const list = await api.getServices();
      setServices(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const openCreateModal = (preset?: PresetOption) => {
    setEditingService(null);
    if (preset) {
      setName(preset.name);
      setCategory(preset.category);
      setUnitType(preset.unit_type);
      setPrice(preset.defaultPrice.toFixed(2));
      setDescription(preset.description);
    } else {
      setName('');
      setCategory('printing');
      setUnitType('per_page');
      setPrice('1.00');
      setDescription('');
    }
    setIsModalOpen(true);
  };

  const openEditModal = (s: Service) => {
    setEditingService(s);
    setName(s.name);
    setCategory(s.category);
    setUnitType(s.unit_type);
    setPrice(s.price.toString());
    setDescription(s.description || '');
    setIsModalOpen(true);
  };

  // Quick Inline Price Editing
  const startInlineEdit = (s: Service) => {
    setInlineEditingId(s.id);
    setInlinePriceInput(s.price.toString());
  };

  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlinePriceInput('');
  };

  const saveInlinePrice = async (serviceId: string) => {
    const num = parseFloat(inlinePriceInput);
    if (isNaN(num) || num < 0) {
      alert('Please enter a valid positive number for the price.');
      return;
    }

    setInlineLoadingId(serviceId);
    try {
      const updated = await api.quickUpdateService(serviceId, { price: num });
      setServices((prev) => prev.map((s) => (s.id === serviceId ? updated : s)));
      cancelInlineEdit();
      showFeedback(`Updated price for "${updated.name}" to ${currency} ${num.toFixed(2)}`);
    } catch (err: any) {
      alert(err.message || 'Failed to update price.');
    } finally {
      setInlineLoadingId(null);
    }
  };

  // Toggle Active / Paused
  const handleToggleActive = async (s: Service) => {
    setInlineLoadingId(s.id);
    try {
      const newStatus = !s.is_active;
      const updated = await api.quickUpdateService(s.id, { is_active: newStatus });
      setServices((prev) => prev.map((item) => (item.id === s.id ? updated : item)));
      showFeedback(
        newStatus
          ? `"${s.name}" is now active on your customer price calculator.`
          : `"${s.name}" paused (temporarily hidden from customer calculator).`
      );
    } catch (err: any) {
      alert(err.message || 'Failed to toggle service status.');
    } finally {
      setInlineLoadingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert('Please enter a valid price.');
      return;
    }

    try {
      if (editingService) {
        const updated = await api.updateService(editingService.id, {
          name,
          category,
          unit_type: unitType,
          price: numericPrice,
          description,
        });
        setServices((prev) => prev.map((s) => (s.id === editingService.id ? updated : s)));
        showFeedback(`Successfully updated price for "${name}".`);
      } else {
        const created = await api.createService({
          name,
          category,
          unit_type: unitType,
          price: numericPrice,
          description,
          is_active: true,
        });
        setServices((prev) => [...prev, created]);
        showFeedback(`Added new service "${name}" at ${currency} ${numericPrice.toFixed(2)}.`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save service.');
    }
  };

  const handleDelete = async (id: string, serviceName: string) => {
    if (!confirm(`Are you sure you want to remove "${serviceName}" from your pricing catalog?`)) return;
    try {
      await api.deleteService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      showFeedback(`Removed "${serviceName}" from pricing catalog.`);
    } catch (err: any) {
      alert(err.message || 'Failed to delete service.');
    }
  };

  const currency = tenant?.settings?.currency_symbol || 'GH₵';

  // Filtered services
  const filteredServices = services.filter((s) => {
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const countForCategory = (cat: string) => {
    if (cat === 'all') return services.length;
    return services.filter((s) => s.category === cat).length;
  };

  return (
    <div className="space-y-6">
      {/* Toast / Feedback Banner */}
      {feedbackMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Services & Pricing Catalog
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {services.length} Configured Rates
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure live per-page and finishing rates. Customer quotes on your countertop QR link are calculated automatically from these prices.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchServices}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh prices"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            onClick={() => openCreateModal()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Price</span>
          </button>
        </div>
      </div>

      {/* Quick Add Industry Presets Panel */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              One-Click Standard Print Presets
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Click any preset to pre-fill and add to your menu
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {COMMON_PRESETS.map((preset, idx) => {
            const alreadyExists = services.some(
              (s) => s.name.toLowerCase() === preset.name.toLowerCase()
            );
            return (
              <button
                key={idx}
                onClick={() => openCreateModal(preset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  alreadyExists
                    ? 'bg-white/80 border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50'
                    : 'bg-white border border-blue-300 text-blue-800 shadow-xs hover:bg-blue-600 hover:text-white'
                }`}
                title={`Click to add ${preset.name} (${currency} ${preset.defaultPrice.toFixed(2)})`}
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span>{preset.name}</span>
                <span className="opacity-75 font-mono text-[11px]">
                  ({currency} {preset.defaultPrice.toFixed(2)})
                </span>
                {alreadyExists && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" title="Already in catalog" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'printing', label: 'Printing (A4/A3)' },
            { id: 'finishing', label: 'Finishing & Binding' },
            { id: 'copying', label: 'Photocopying' },
            { id: 'other', label: 'Other & Scanning' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedCategory === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedCategory === tab.id ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {countForCategory(tab.id)}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search price item..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Services Grid by Category */}
      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading pricing catalog...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <DollarSign className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No services found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No service matches "${searchQuery}". Try clearing your search.`
              : 'Add your printing and finishing prices so customers can automatically calculate order costs.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => openCreateModal()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Price</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredServices.map((svc) => {
            const isEditingThisPrice = inlineEditingId === svc.id;
            const isBusy = inlineLoadingId === svc.id;

            return (
              <div
                key={svc.id}
                className={`p-5 rounded-2xl bg-white border shadow-xs flex flex-col justify-between transition-all ${
                  !svc.is_active
                    ? 'border-slate-200 opacity-60 bg-slate-50/50'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                          {svc.category}
                        </span>
                        {!svc.is_active && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Paused
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{svc.name}</h3>
                    </div>

                    {/* Price Section with Quick Inline Edit */}
                    <div className="text-right shrink-0">
                      {isEditingThisPrice ? (
                        <div className="flex items-center gap-1">
                          <div className="flex items-center rounded-lg border-2 border-blue-500 bg-white px-2 py-1 shadow-xs">
                            <span className="text-xs font-bold text-slate-400 mr-1">{currency}</span>
                            <input
                              type="number"
                              step="0.01"
                              autoFocus
                              value={inlinePriceInput}
                              onChange={(e) => setInlinePriceInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlinePrice(svc.id);
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              className="w-20 text-sm font-black text-blue-700 outline-none"
                            />
                          </div>
                          <button
                            onClick={() => saveInlinePrice(svc.id)}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                            title="Save Price"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelInlineEdit}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => startInlineEdit(svc)}
                          className="group cursor-pointer rounded-lg p-1 -m-1 hover:bg-blue-50/80 transition-colors"
                          title="Click to quickly edit price"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-lg font-black text-blue-700">
                              {currency} {svc.price.toFixed(2)}
                            </span>
                            <Edit2 className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                          </div>
                          <span className="block text-[10px] text-slate-400 capitalize">
                            {svc.unit_type.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {svc.description && (
                    <p className="text-xs text-slate-600 leading-relaxed mt-2">{svc.description}</p>
                  )}
                </div>

                {/* Footer Controls: Toggle Active Status & Actions */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs">
                  {/* Active Toggle Switch */}
                  <button
                    onClick={() => handleToggleActive(svc)}
                    disabled={isBusy}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                      svc.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                    title={svc.is_active ? 'Click to temporarily pause this rate' : 'Click to activate this rate'}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        svc.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <span>{svc.is_active ? 'Active on Calculator' : 'Paused (Hidden)'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(svc)}
                      className="px-2.5 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Edit Service Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(svc.id, svc.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Service"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Price Calculation How-It-Works Guide */}
      <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs sm:text-sm font-bold text-white">
            How Your Prices Work in the Public Order Calculator
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          When customers upload files at your countertop link, the system checks these active rates:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <span className="text-[10px] font-bold uppercase text-blue-400 block mb-1">
              1. Base Printing
            </span>
            <p className="text-slate-300 text-[11px]">
              Matches paper size (<strong>A4</strong> / <strong>A3</strong>) and color mode (<strong>B&W</strong> or <strong>Colour</strong>) × total pages calculated × copies.
            </p>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <span className="text-[10px] font-bold uppercase text-indigo-400 block mb-1">
              2. Binding & Finishing
            </span>
            <p className="text-slate-300 text-[11px]">
              Matches selected binding option (e.g. <strong>Spiral</strong>, <strong>Hardcover Thesis</strong>, <strong>Staple</strong>) × copies.
            </p>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <span className="text-[10px] font-bold uppercase text-emerald-400 block mb-1">
              3. Lamination & Add-ons
            </span>
            <p className="text-slate-300 text-[11px]">
              Calculates lamination per item or per document according to the unit type you selected above.
            </p>
          </div>
        </div>
      </div>

      {/* Add / Edit Full Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {editingService ? `Edit Price: ${editingService.name}` : 'Add New Service & Price'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. A4 Full Colour Laser Print"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-none"
                  >
                    <option value="printing">Printing</option>
                    <option value="finishing">Finishing / Binding</option>
                    <option value="copying">Photocopying</option>
                    <option value="other">Other / Scanning</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Type</label>
                  <select
                    value={unitType}
                    onChange={(e) => setUnitType(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-none"
                  >
                    <option value="per_page">Per Page (Calculated with doc pages)</option>
                    <option value="per_document">Per Document / Copy</option>
                    <option value="per_item">Per Item</option>
                    <option value="fixed">Fixed Flat Fee</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Price ({currency})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="2.00"
                    className="w-full h-10 pl-14 pr-3 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 80gsm bond paper, crisp 1200dpi laser output"
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors"
                >
                  {editingService ? 'Save Changes' : 'Create Service & Price'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
