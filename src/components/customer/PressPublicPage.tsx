import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  Upload,
  Search,
  CheckCircle,
  FileText,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import { Tenant, Service } from '../../types';

interface PressPublicPageProps {
  slug: string;
  onStartUpload: () => void;
  onTrackOrder: () => void;
}

export const PressPublicPage: React.FC<PressPublicPageProps> = ({
  slug,
  onStartUpload,
  onTrackOrder,
}) => {
  const [press, setPress] = useState<(Tenant & { services: Service[] }) | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    api
      .getPublicPress(slug)
      .then((data) => setPress(data))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-600 font-medium text-sm">Connecting to printing press...</p>
        </div>
      </div>
    );
  }

  if (error || !press) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Printing Press Unavailable</h2>
        <p className="text-sm text-slate-600 mb-6">{error || 'This printing press profile could not be found.'}</p>
        <button
          onClick={onTrackOrder}
          className="w-full py-2.5 px-4 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
        >
          Track An Existing Job
        </button>
      </div>
    );
  }

  const printingServices = press.services.filter((s) => s.category === 'printing');
  const finishingServices = press.services.filter((s) => s.category === 'finishing' || s.category === 'other');

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      {/* Top Banner & Shop Profile Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mb-6">
        {/* Decorative Top Accent */}
        <div className="h-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-orange-500" />

        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-100">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                {press.logo_url ? (
                  <img
                    src={press.logo_url}
                    alt={press.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Building2 className="w-8 h-8 text-blue-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {press.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Press
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    <strong className="font-semibold text-slate-800">{press.location}</strong>
                    {press.address ? ` — ${press.address}` : ''}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{press.settings?.operating_hours || 'Mon–Sat: 8:00 AM – 7:00 PM'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Business Description */}
          {press.description && (
            <p className="text-sm text-slate-600 mt-4 leading-relaxed">{press.description}</p>
          )}

          {/* Quick Contact & Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-6 pt-4 border-t border-slate-100">
            {press.phone && (
              <a
                href={`tel:${press.phone.replace(/[^0-9+]/g, '')}`}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>Call Shop</span>
              </a>
            )}

            {press.settings?.contact_whatsapp && (
              <a
                href={`https://wa.me/${press.settings?.contact_whatsapp.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                  press.name
                )},%20I%20have%20an%20inquiry%20about%20printing.`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </a>
            )}

            <button
              onClick={onTrackOrder}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors col-span-2 sm:col-span-1"
            >
              <Search className="w-3.5 h-3.5 text-amber-600" />
              <span>Track Job</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero Upload CTA Card */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg shadow-blue-500/15 mb-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/15 text-blue-100 backdrop-blur-xs mb-2">
              No App or Sign-up Required
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Send Your Document Directly to the Press
            </h2>
            <p className="text-sm text-blue-100 mt-1 max-w-md">
              Skip the WhatsApp queue. Upload your PDF, Word, or images, choose your paper options, and get an instant job number.
            </p>
          </div>
          <button
            id="start-upload-btn"
            onClick={onStartUpload}
            className="w-full sm:w-auto shrink-0 px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-blue-700 font-bold text-base shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-98"
          >
            <Upload className="w-5 h-5 text-blue-600" />
            <span>Upload Document</span>
            <ChevronRight className="w-4 h-4 text-blue-400" />
          </button>
        </div>
      </div>

      {/* Available Services & Transparent Pricing */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Printing Services & Pricing</h3>
            <p className="text-xs text-slate-500">Configured rates for this printing press</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {press.settings?.currency_symbol || 'GH₵'} (GHS)
          </span>
        </div>

        {/* Printing Rates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {printingServices.map((service) => (
            <div
              key={service.id}
              className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/40 hover:border-blue-200 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{service.name}</p>
                {service.description && (
                  <p className="text-xs text-slate-500 line-clamp-1">{service.description}</p>
                )}
              </div>
              <div className="text-right shrink-0 ml-3">
                <span className="text-sm font-bold text-blue-700">
                  {press.settings?.currency_symbol || 'GH₵'} {service.price.toFixed(2)}
                </span>
                <span className="block text-[10px] text-slate-400 font-medium capitalize">
                  {service.unit_type.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Finishing & Binding Services */}
        {finishingServices.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Binding, Lamination & Finishing
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {finishingServices.map((service) => (
                <div
                  key={service.id}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{service.name}</p>
                    {service.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">{service.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-sm font-bold text-slate-900">
                      {press.settings?.currency_symbol || 'GH₵'} {service.price.toFixed(2)}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-medium capitalize">
                      {service.unit_type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accepted File Formats & Security Badge */}
      <div className="p-4 rounded-xl bg-slate-100 text-slate-600 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Supported files: <strong>PDF, DOCX, DOC, PPTX, JPG, PNG</strong> (Max {press.settings?.max_file_size_mb || 25}MB)
          </span>
        </div>
        <span className="text-slate-500">Encrypted transmission & auto-purged retention</span>
      </div>
    </div>
  );
};
