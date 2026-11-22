import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  Info,
  BookOpen,
  Database,
  AlertTriangle,
  LogIn,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Calendar,
  Activity,
  RefreshCw
} from 'lucide-react';
import { diseaseService } from '../../services/diseaseService';
import { DatasetService } from '../../services/datasetService';
import { getDiseaseImages } from '../../data/diseaseImages';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';

export default function ExplorePage() {
  const { t, translateDisease, translateCategory, translateSubCategory, isHindi } = useLanguage();
  const [activeTab, setActiveTab] = useState('library'); // 'library' or 'datasets'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrimaryCategory, setSelectedPrimaryCategory] = useState('All Conditions');
  const [selectedSubCategory, setSelectedSubCategory] = useState('All');

  // Asynchronous diseases dataset state
  const [diseases, setDiseases] = useState([]);
  const [primaryCategories, setPrimaryCategories] = useState(['All Conditions']);
  const [subCategories, setSubCategories] = useState(['All']);
  const [isLoadingDiseases, setIsLoadingDiseases] = useState(true);
  const [diseaseError, setDiseaseError] = useState(null);

  // Dataset explorer filter state
  const [datasetSearch, setDatasetSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedMetric, setSelectedMetric] = useState('All');
  const [datasetsList, setDatasetsList] = useState([]);
  const [_isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const isMountedRef = React.useRef(true);

  // Load curated disease knowledgebase via data service
  const loadDiseases = React.useCallback(async (refresh = false) => {
    setIsLoadingDiseases(true);
    setDiseaseError(null);
    try {
      const data = await diseaseService.getAllDiseases(refresh);
      if (isMountedRef.current) {
        setDiseases(data);
      }
      const cats = await diseaseService.getCategories();
      if (isMountedRef.current) {
        setPrimaryCategories(cats);
      }
      const subs = await diseaseService.getSubCategories();
      if (isMountedRef.current) {
        setSubCategories(subs);
      }
    } catch (err) {
      console.error('Failed to load disease library:', err);
      if (isMountedRef.current) {
        setDiseaseError('Unable to load health library. Please check your network and try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingDiseases(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadDiseases();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadDiseases]);

  // Load datasets when dataset tab is active or filters change
  useEffect(() => {
    isMountedRef.current = true;
    async function fetchDatasets() {
      setIsLoadingDatasets(true);
      try {
        const results = await DatasetService.searchDatasets(datasetSearch, {
          country: selectedCountry,
          year: selectedYear,
          metricType: selectedMetric
        });
        if (isMountedRef.current) setDatasetsList(results);
      } catch (err) {
        console.error('Failed to load datasets:', err);
      } finally {
        if (isMountedRef.current) setIsLoadingDatasets(false);
      }
    }
    fetchDatasets();
    return () => { isMountedRef.current = false; };
  }, [datasetSearch, selectedCountry, selectedYear, selectedMetric]);

  // Filter diseases in library (supports multilingual search in English and Hindi)
  const filteredDiseases = useMemo(() => {
    return diseases.filter(disease => {
      const matchesPrimary =
        selectedPrimaryCategory === 'All Conditions' ||
        disease.categoryGroup === selectedPrimaryCategory;

      const matchesSub =
        selectedSubCategory === 'All' ||
        disease.subCategory === selectedSubCategory;

      const q = searchQuery.toLowerCase().trim();
      const localized = translateDisease(disease);

      const matchesSearch =
        !q ||
        disease.name?.toLowerCase().includes(q) ||
        localized?.name?.toLowerCase().includes(q) ||
        (disease.medicalName && disease.medicalName.toLowerCase().includes(q)) ||
        (localized?.medicalName && localized.medicalName.toLowerCase().includes(q)) ||
        (disease.shortDescription && disease.shortDescription.toLowerCase().includes(q)) ||
        (localized?.shortDescription && localized.shortDescription.toLowerCase().includes(q)) ||
        (Array.isArray(disease.signsYouMayNotice) && disease.signsYouMayNotice.some(s => s?.toLowerCase().includes(q))) ||
        (Array.isArray(localized?.signsYouMayNotice) && localized.signsYouMayNotice.some(s => s?.toLowerCase().includes(q)));

      return matchesPrimary && matchesSub && matchesSearch;
    });
  }, [diseases, searchQuery, selectedPrimaryCategory, selectedSubCategory, translateDisease]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Top Navigation Bar: Language Switcher & Back to Login */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[14px] font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/25 shadow-xs">
          <BookOpen className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
          <span>{isHindi ? 'सार्वजनिक स्वास्थ्य ज्ञानकोष एवं आधिकारिक डेटा' : 'Public Health Library & Official Datasets'}</span>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[14px] font-bold text-cyan-700 dark:text-cyan-300 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <LogIn className="w-4 h-4" />
            <span>{t('nav.login', {}, 'Login')}</span>
          </Link>
        </div>
      </div>

      {/* Header Banner - Fully dynamic count */}
      <div className="space-y-4 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
          {t('explore.title', {}, 'Understand Your Health')}
        </h1>

        <p className="text-[19px] sm:text-[20px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {isHindi
            ? `सार्वजनिक स्वास्थ्य पुस्तकालय में सभी ${diseases.length || 97} स्वास्थ्य स्थितियों के लिए साक्ष्य-आधारित, चिकित्सकीय रूप से सत्यापित विस्तृत विवरण।`
            : `Evidence-based, medically verified overviews with high-resolution clinical presentation imagery across all ${diseases.length || 97} conditions in the public health library.`}
        </p>
      </div>

      {/* Main View Mode Selector (Library vs Official Datasets) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-card text-[15px] font-semibold w-fit shadow-xs">
          <button
            onClick={() => setActiveTab('library')}
            className={`px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold shadow-xs active:scale-95'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isHindi ? 'रोग सूचना ज्ञानकोष (Disease Library)' : 'Disease Information Library'}
          </button>
          <button
            onClick={() => setActiveTab('datasets')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'datasets'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold shadow-xs active:scale-95'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>{isHindi ? 'आधिकारिक स्वास्थ्य डेटासेट' : 'Official Health Datasets'}</span>
          </button>
        </div>

        <span className="text-[14px] text-slate-500 dark:text-slate-400">
          {isHindi ? 'स्रोत: WHO GHO, भारत Data.gov.in, एवं CDC' : 'Sources: WHO GHO, India Data.gov.in, and CDC'}
        </span>
      </div>

      {/* TAB 1: DISEASE INFORMATION LIBRARY */}
      {activeTab === 'library' && (
        <div className="space-y-8">
          
          {/* Important Symptom Notice */}
          <div className="p-5 rounded-3xl bg-cyan-500/10 border border-cyan-500/25 flex items-start gap-4 text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed shadow-xs">
            <AlertTriangle className="w-6 h-6 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-cyan-800 dark:text-cyan-300">
                {isHindi ? 'महत्वपूर्ण चिकित्सीय संदर्भ:' : 'Important Medical Context:'}
              </strong>{' '}
              {isHindi
                ? 'बुखार, खांसी और पीलिया अपने आप में स्वतंत्र रोग नहीं हैं, बल्कि अंतर्निहित बीमारियों (जैसे संक्रमण, एलर्जी या लिवर विकार) के स्वाभाविक चेतावनी संकेत हैं। हमेशा चिकित्सक से परामर्श कर मूल कारण का निदान कराएं।'
                : 'Fever, cough, and jaundice are natural warning signs of an underlying condition (like an infection, allergy, or liver issue), rather than diseases by themselves. Always look for the root cause with a healthcare provider.'}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('explore.searchPlaceholder', {}, 'Search by condition, medical term, symptoms, or category...')}
              className="w-full pl-14 pr-12 py-4 rounded-2xl glass-card text-[17px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                {t('explore.clearSearch', {}, 'Clear')}
              </button>
            )}
          </div>

          {/* Primary Category Tabs with Dynamic Derivation */}
          <div className="space-y-3">
            <p className="text-[14px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('explore.primaryCategories', {}, 'Categories')}
            </p>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {primaryCategories.map(category => {
                const count = category === 'All Conditions'
                  ? diseases.length
                  : diseases.filter(d => d.categoryGroup === category).length;

                return (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedPrimaryCategory(category);
                      setSelectedSubCategory('All');
                    }}
                    className={`px-5 py-2.5 rounded-2xl text-[15px] font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
                      selectedPrimaryCategory === category
                        ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20 active:scale-95'
                        : 'glass-card text-slate-700 dark:text-slate-300 hover:border-cyan-500/50'
                    }`}
                  >
                    <span>{translateCategory(category)}</span>
                    {count > 0 && (
                      <span className={`text-[12px] px-2 py-0.5 rounded-full font-bold ${
                        selectedPrimaryCategory === category
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subcategory Pills with Dynamic Derivation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {subCategories.map(sub => (
              <button
                key={sub}
                onClick={() => setSelectedSubCategory(sub)}
                className={`px-3.5 py-1.5 rounded-xl text-[13px] font-medium shrink-0 transition-all cursor-pointer ${
                  selectedSubCategory === sub
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {translateSubCategory(sub)}
              </button>
            ))}
          </div>

          {/* Disease Cards Grid / Loading / Error State */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-[15px] text-slate-500 dark:text-slate-400 font-medium">
                {t('explore.showingCount', { count: filteredDiseases.length }, `Showing ${filteredDiseases.length} of ${diseases.length} conditions`)}
              </p>
            </div>

            {/* LOADING STATE */}
            {isLoadingDiseases ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="glass-card rounded-3xl p-6 space-y-4 animate-pulse border border-slate-200 dark:border-slate-800">
                    <div className="w-full h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                    <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : diseaseError ? (
              /* ERROR STATE */
              <div className="p-12 text-center rounded-3xl glass-card space-y-4 border border-rose-500/30">
                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {isHindi ? 'डेटा लोड करने में असमर्थ' : 'Unable to Load Disease Library'}
                </h3>
                <p className="text-[16px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {diseaseError}
                </p>
                <button
                  onClick={() => loadDiseases(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[15px] font-bold bg-cyan-400 text-slate-950 cursor-pointer shadow-xs active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{isHindi ? 'पुनः प्रयास करें' : 'Retry'}</span>
                </button>
              </div>
            ) : filteredDiseases.length === 0 ? (
              /* EMPTY STATE */
              <div className="p-12 text-center rounded-3xl glass-card space-y-4">
                <Info className="w-10 h-10 text-cyan-500 dark:text-cyan-400 mx-auto" />
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {t('explore.noResults', {}, 'No results found')}
                </h3>
                <p className="text-[16px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {t('explore.noResultsDesc', {}, 'Try searching with a different word or select "All Conditions" above.')}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPrimaryCategory('All Conditions');
                    setSelectedSubCategory('All');
                  }}
                  className="px-6 py-2.5 rounded-xl text-[15px] font-bold bg-cyan-400 text-slate-950 cursor-pointer shadow-xs active:scale-95"
                >
                  {t('explore.clearFilters', {}, 'Reset Filters')}
                </button>
              </div>
            ) : (
              /* ACTIVE CARDS GRID */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDiseases.map(disease => {
                  const localized = translateDisease(disease);
                  const diseaseImg = getDiseaseImages(disease.id);
                  return (
                    <Link
                      key={disease.id}
                      to={`/explore/${disease.id}`}
                      className="glass-card glass-card-hover group rounded-3xl flex flex-col justify-between overflow-hidden transition-all border border-slate-200/80 dark:border-slate-800 hover:border-cyan-500/40 shadow-sm"
                    >
                      {/* Clinical Thumbnail Image */}
                      <div className="relative w-full h-48 overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img
                          src={diseaseImg.primaryImage}
                          alt={diseaseImg.primaryAlt || localized.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1000&q=80';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                        <span className="absolute bottom-3 left-3 text-[11px] font-bold text-white bg-slate-900/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20">
                          {translateCategory(diseaseImg.badge || disease.categoryGroup)}
                        </span>
                        {diseaseImg.isSpecificPhoto === false && (
                          <span className="absolute top-3 right-3 text-[10px] font-medium text-slate-300 bg-slate-950/75 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
                            {isHindi ? 'संदर्भ गाइड' : 'Reference Guide'}
                          </span>
                        )}
                      </div>

                      <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                              {translateCategory(disease.categoryGroup)}
                            </span>

                            {disease.isSymptomSign && (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                {isHindi ? 'लक्षण / संकेत' : 'Sign / Symptom'}
                              </span>
                            )}
                          </div>

                          <h3 className="text-2xl font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                            {localized.name}
                          </h3>

                          <p className="text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                            {localized.shortDescription}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[15px] font-bold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform">
                          <span>{isHindi ? 'विस्तृत विवरण एवं चित्र देखें' : 'Read Simple Guide & Photos'}</span>
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OFFICIAL HEALTH DATASETS */}
      {activeTab === 'datasets' && (
        <div className="space-y-8">
          <div className="p-6 rounded-3xl glass-card border border-cyan-500/30 space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-6 h-6 text-cyan-500" />
              <span>{isHindi ? 'आधिकारिक वैश्विक एवं राष्ट्रीय स्वास्थ्य डेटा' : 'Official Global & National Health Surveillance'}</span>
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-[15px]">
              {isHindi
                ? 'विश्व स्वास्थ्य संगठन (WHO), भारत सरकार (data.gov.in / MoHFW), और यूएस सीडीसी (CDC) से प्रमाणित महामारी विज्ञान डेटा।'
                : 'Empirical epidemiological datasets synchronized from WHO Global Health Observatory, India Open Government Data (MOHFW), and the CDC.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
