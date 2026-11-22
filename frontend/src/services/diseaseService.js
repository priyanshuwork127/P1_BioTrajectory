/**
 * BioTrajectory Disease Library Data Service
 * 
 * Provides an asynchronous, maintainable data layer for all disease information.
 * Features:
 * - Decouples UI pages from data structures
 * - Asynchronously fetches from BioTrajectory backend API (/api/diseases) when available
 * - Falls back to bundled, medically-curated knowledgebase (DISEASES_DATABASE) when offline or in static deploy
 * - Dynamically derives categories, subcategories, and counts without hardcoded numbers
 */

import {
  DISEASES_DATABASE,
  PRIMARY_CATEGORIES,
  SUB_CATEGORIES
} from '../data/diseasesData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

class DiseaseService {
  constructor() {
    this._cachedDiseases = null;
    this._cachedCategories = null;
    this._cachedSubCategories = null;
  }

  /**
   * Fetch all diseases asynchronously with offline-first resilience.
   */
  async getAllDiseases(forceRefresh = false) {
    if (this._cachedDiseases && !forceRefresh) {
      return this._cachedDiseases;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${API_BASE_URL}/api/diseases`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.diseases) && data.diseases.length > 0) {
          this._cachedDiseases = data.diseases;
          if (Array.isArray(data.primary_categories)) {
            this._cachedCategories = data.primary_categories;
          }
          if (Array.isArray(data.sub_categories)) {
            this._cachedSubCategories = data.sub_categories;
          }
          return this._cachedDiseases;
        }
      }
    } catch {
      // Graceful fallback to bundled curated data
    }

    // Default fallback to bundled knowledgebase
    this._cachedDiseases = DISEASES_DATABASE;
    return this._cachedDiseases;
  }

  /**
   * Retrieve a single disease by its identifier.
   */
  async getDiseaseById(id) {
    if (!id) return null;

    // Check memory cache first
    if (this._cachedDiseases) {
      const match = this._cachedDiseases.find(d => d.id === id);
      if (match) return match;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${API_BASE_URL}/api/diseases/${encodeURIComponent(id)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const disease = await res.json();
        if (disease && disease.id) return disease;
      }
    } catch {
      // Fallback
    }

    // Fallback to bundled dataset
    return DISEASES_DATABASE.find(d => d.id === id) || null;
  }

  /**
   * Dynamically derive primary categories from the loaded diseases dataset.
   */
  async getCategories() {
    if (this._cachedCategories) {
      return this._cachedCategories;
    }

    const diseases = await this.getAllDiseases();
    const categoriesSet = new Set();
    diseases.forEach(d => {
      if (d.categoryGroup) categoriesSet.add(d.categoryGroup);
    });

    const categories = ['All Conditions', ...Array.from(categoriesSet)];
    this._cachedCategories = categories.length > 1 ? categories : PRIMARY_CATEGORIES;
    return this._cachedCategories;
  }

  /**
   * Dynamically derive subcategories from the loaded diseases dataset.
   */
  async getSubCategories(categoryGroup = null) {
    const diseases = await this.getAllDiseases();
    const subSet = new Set();

    diseases.forEach(d => {
      if (!categoryGroup || categoryGroup === 'All Conditions' || d.categoryGroup === categoryGroup) {
        if (d.subCategory) subSet.add(d.subCategory);
      }
    });

    const subCategories = ['All', ...Array.from(subSet)];
    return subCategories.length > 1 ? subCategories : SUB_CATEGORIES;
  }

  /**
   * Filter and search diseases with query parameters.
   */
  async searchDiseases(query = '', { category = 'All Conditions', subCategory = 'All' } = {}) {
    const diseases = await this.getAllDiseases();
    const q = query.toLowerCase().trim();

    return diseases.filter(disease => {
      const matchesCategory =
        category === 'All Conditions' ||
        disease.categoryGroup?.toLowerCase() === category.toLowerCase();

      const matchesSub =
        subCategory === 'All' ||
        disease.subCategory?.toLowerCase() === subCategory.toLowerCase();

      if (!matchesCategory || !matchesSub) return false;
      if (!q) return true;

      const nameMatch = disease.name?.toLowerCase().includes(q);
      const medicalNameMatch = disease.medicalName?.toLowerCase().includes(q);
      const descMatch = disease.shortDescription?.toLowerCase().includes(q);
      const signsMatch = Array.isArray(disease.signsYouMayNotice) &&
        disease.signsYouMayNotice.some(s => s?.toLowerCase().includes(q));
      const causesMatch = Array.isArray(disease.whyDoesItHappen) &&
        disease.whyDoesItHappen.some(c => c?.toLowerCase().includes(q));

      return nameMatch || medicalNameMatch || descMatch || signsMatch || causesMatch;
    });
  }
}

export const diseaseService = new DiseaseService();
export default diseaseService;
