import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  UserPlus,
  X,
  Mail,
  User,
  Key,
  Copy,
  Check,
  AlertCircle,
  Lock,
  Sparkles,
  Search
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import adminDashboardService from '../../services/adminDashboardService';

export default function AddAdminModal({ isOpen, onClose, onAdminAdded, existingUsers = [] }) {
  const { isHindi } = useLanguage();

  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'promote'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleTier, setRoleTier] = useState('SUPER_ADMIN');
  const [tempPass, setTempPass] = useState(() => `BT-ADM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [complianceVerified, setComplianceVerified] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Search for promoting existing user
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [selectedPromoteUser, setSelectedPromoteUser] = useState(null);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard?.writeText(tempPass);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRegenerateKey = () => {
    setTempPass(`BT-ADM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError(isHindi ? 'कृपया व्यवस्थापक का पूरा नाम दर्ज करें।' : 'Please enter administrator full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError(isHindi ? 'कृपया वैध आधिकारिक ईमेल दर्ज करें।' : 'Please enter a valid official email address.');
      return;
    }
    if (!complianceVerified) {
      setError(isHindi ? 'कृपया अनुपालन एवं पहचान सत्यापन की पुष्टि करें।' : 'Please verify compliance authorization before proceeding.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await adminDashboardService.addAdmin({
        name: name.trim(),
        email: email.trim(),
        roleTier,
        temporaryPassword: tempPass
      });

      if (onAdminAdded) {
        onAdminAdded(res.admin, `Administrator ${res.admin.name} registered.`);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create administrator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromoteExisting = (e) => {
    e.preventDefault();
    if (!selectedPromoteUser) {
      setError(isHindi ? 'कृपया प्रमोट करने हेतु उपयोगकर्ता चुनें।' : 'Please select a user to promote.');
      return;
    }
    if (!complianceVerified) {
      setError(isHindi ? 'कृपया अनुपालन सत्यापन की पुष्टि करें।' : 'Please verify compliance authorization before proceeding.');
      return;
    }

    try {
      setIsSubmitting(true);
      adminDashboardService.promoteUserToAdmin(selectedPromoteUser.uid, roleTier);

      if (onAdminAdded) {
        onAdminAdded(
          { ...selectedPromoteUser, role: 'ADMIN', roleTier },
          `${selectedPromoteUser.name} elevated to Administrator role.`
        );
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to promote user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nonAdminUsers = existingUsers.filter(u => u.role !== 'ADMIN');
  const filteredUsers = nonAdminUsers.filter(u => {
    const q = searchUserQuery.toLowerCase().trim();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#251A11] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-300 flex items-center justify-center border border-purple-500/30">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isHindi ? 'नया व्यवस्थापक जोड़ें' : 'Add New Administrator'}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                  RBAC
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isHindi
                  ? 'सुरक्षित भूमिका-आधारित पहुंच नियंत्रण (RBAC) के साथ प्रशासनिक क्रेडेंशियल जारी करें।'
                  : 'Provision administrative credentials with audited RBAC privilege tiers.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: Invite New vs Promote Existing */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-[#1F150E] text-xs font-bold">
          <button
            type="button"
            onClick={() => { setActiveTab('new'); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'new'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isHindi ? 'नया व्यवस्थापक बनाएँ' : 'Provision New Admin'}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('promote'); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'promote'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isHindi ? 'मौजूदा उपयोगकर्ता को प्रमोट करें' : 'Promote Existing User'}
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Form Content */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {activeTab === 'new' ? (
            <form id="new-admin-form" onSubmit={handleCreateAdmin} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isHindi ? 'व्यवस्थापक का पूरा नाम' : 'Administrator Full Name'} *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Marcus Sterling"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-[#1F150E] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              {/* Work Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isHindi ? 'आधिकारिक कार्य ईमेल' : 'Official Work Email'} *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. m.sterling@biotrajectory.health"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-[#1F150E] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>
            </form>
          ) : (
            <form id="promote-admin-form" onSubmit={handlePromoteExisting} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isHindi ? 'उपयोगकर्ता खोजें एवं चुनें' : 'Search & Select User to Elevate'}
                </label>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchUserQuery}
                    onChange={(e) => setSearchUserQuery(e.target.value)}
                    placeholder={isHindi ? 'नाम या ईमेल द्वारा खोजें...' : 'Search by patient or doctor name...'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-[#1F150E] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No eligible users found.
                    </div>
                  ) : (
                    filteredUsers.slice(0, 6).map((u) => (
                      <div
                        key={u.uid}
                        onClick={() => setSelectedPromoteUser(u)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          selectedPromoteUser?.uid === u.uid
                            ? 'bg-purple-500/15 border-l-4 border-purple-500 text-purple-900 dark:text-purple-200 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{u.name}</p>
                          <p className="text-[10px] text-slate-400">{u.email || u.uid}</p>
                        </div>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {u.role}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {selectedPromoteUser && (
                  <div className="mt-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 font-bold">
                    <Check className="w-4 h-4 text-purple-500" />
                    <span>Selected: {selectedPromoteUser.name} ({selectedPromoteUser.email})</span>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* Administrative Privilege Tier Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isHindi ? 'प्रशासनिक विशेषाधिकार स्तर' : 'Administrative Privilege Tier'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'SUPER_ADMIN',
                  label: 'Super Admin',
                  desc: 'Unrestricted root governance & config'
                },
                {
                  id: 'CLINICAL_ADMIN',
                  label: 'Clinical Ops',
                  desc: 'Doctor verification & triage logs'
                },
                {
                  id: 'SECURITY_ADMIN',
                  label: 'Compliance',
                  desc: 'Zero-knowledge & audit verification'
                }
              ].map((tier) => (
                <div
                  key={tier.id}
                  onClick={() => setRoleTier(tier.id)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    roleTier === tier.id
                      ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <p className="text-xs font-bold">{tier.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{tier.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Temporary Access Passphrase (for new admin) */}
          {activeTab === 'new' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#1F150E] border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5" /> Temporary Access Token
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRegenerateKey}
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-bold"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-bold flex items-center gap-0.5"
                  >
                    {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <p className="font-mono text-xs font-bold text-slate-900 dark:text-white tracking-widest bg-white dark:bg-[#251A11] p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                {tempPass}
              </p>
            </div>
          )}

          {/* Compliance Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#1F150E] border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={complianceVerified}
              onChange={(e) => setComplianceVerified(e.target.checked)}
              className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
            />
            <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              {isHindi
                ? 'मैं प्रमाणित करता हूँ कि इस व्यवस्थापक ने संगठन की HIPAA/GDPR पहचान सत्यापन एवं क्रेडेंशियल नीतियों को पूरा किया है।'
                : 'I certify that this administrator has completed mandatory HIPAA / GDPR identity verification and organizational authorization.'}
            </span>
          </label>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isHindi ? 'रद्द करें' : 'Cancel'}
          </button>

          <button
            type="submit"
            form={activeTab === 'new' ? 'new-admin-form' : 'promote-admin-form'}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {isSubmitting
                ? (isHindi ? 'प्रक्रियाधीन...' : 'Provisioning...')
                : activeTab === 'new'
                ? (isHindi ? 'व्यवस्थापक पंजीकृत करें' : 'Grant Admin Privileges')
                : (isHindi ? 'व्यवस्थापक प्रमोट करें' : 'Promote to Admin')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
