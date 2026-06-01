import { create } from 'zustand';
import { projectsApi, samplesApi, exportApi, importApi } from '../utils/api';
import { downloadBlob } from '../utils/ko2';

const useStore = create((set, get) => ({
  // ─── Projects ─────────────────────────────────────────────────────────────
  projects: [],
  currentProject: null,
  projectLoading: false,

  loadProjects: async () => {
    try {
      const res = await projectsApi.list();
      set({ projects: res.data.projects });
    } catch (e) {
      console.error('Failed to load projects:', e);
    }
  },

  loadProject: async (id) => {
    set({ projectLoading: true });
    try {
      const res = await projectsApi.get(id);
      set({ currentProject: res.data.project, projectLoading: false });
    } catch (e) {
      console.error('Failed to load project:', e);
      set({ projectLoading: false });
    }
  },

  createProject: async (data) => {
    const res = await projectsApi.create(data);
    const project = res.data.project;
    set(state => ({
      projects: [...state.projects, project],
      currentProject: project,
    }));
    return project;
  },

  updateProject: async (id, data) => {
    const res = await projectsApi.update(id, data);
    const project = res.data.project;
    set(state => ({
      projects: state.projects.map(p => p.id === id ? project : p),
      currentProject: state.currentProject?.id === id ? project : state.currentProject,
    }));
    return project;
  },

  deleteProject: async (id) => {
    await projectsApi.delete(id);
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }));
  },

  // Add a sound to current project
  addSoundToProject: async (sound) => {
    const { currentProject } = get();
    if (!currentProject) return;
    const res = await projectsApi.addSound(currentProject.id, sound);
    set({ currentProject: res.data.project });
    return res.data.project;
  },

  // Remove a sound from current project
  removeSoundFromProject: async (slot) => {
    const { currentProject } = get();
    if (!currentProject) return;
    const res = await projectsApi.removeSound(currentProject.id, slot);
    set({ currentProject: res.data.project });
  },

  // Update pad assignment
  updatePad: async (group, pad, config) => {
    const { currentProject } = get();
    if (!currentProject) return;
    const res = await projectsApi.updatePad(currentProject.id, group, pad, config);
    set({ currentProject: res.data.project });
  },

  // Update all pads at once (optimistic)
  updatePadsLocal: (padAssignments) => {
    set(state => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, padAssignments }
        : null,
    }));
  },

  savePads: async () => {
    const { currentProject } = get();
    if (!currentProject) return;
    await projectsApi.updatePads(currentProject.id, currentProject.padAssignments);
  },

  // ─── Sample Library ────────────────────────────────────────────────────────
  sampleSets: [],
  currentSetId: null,
  samples: [],
  samplesLoading: false,
  selectedSample: null,
  sampleFilter: { category: null, search: '' },

  loadSampleSets: async () => {
    const res = await samplesApi.getSets();
    set({ sampleSets: res.data.sets });
  },

  loadSamples: async (setId) => {
    set({ samplesLoading: true, currentSetId: setId });
    try {
      const res = setId
        ? await samplesApi.getSamplesInSet(setId)
        : await samplesApi.getAllSamples();
      set({ samples: res.data.samples, samplesLoading: false });
    } catch (e) {
      set({ samplesLoading: false });
    }
  },

  setSelectedSample: (sample) => set({ selectedSample: sample }),
  setSampleFilter: (filter) => set(state => ({
    sampleFilter: { ...state.sampleFilter, ...filter }
  })),

  // ─── Export / Import ───────────────────────────────────────────────────────
  exporting: false,
  importing: false,

  exportProject: async (id) => {
    set({ exporting: true });
    try {
      const { currentProject } = get();
      const project = currentProject?.id === id ? currentProject : null;
      const name = project?.name || 'project';
      const res = await exportApi.exportProject(id);
      const filename = `${name.replace(/\s+/g, '_')}_P01_backup.ppak`;
      downloadBlob(res.data, filename);
    } finally {
      set({ exporting: false });
    }
  },

  importPpak: async (file, name) => {
    set({ importing: true });
    try {
      const res = await importApi.importPpak(file, name);
      const project = res.data.project;
      set(state => ({
        projects: [...state.projects, project],
        currentProject: project,
        importing: false,
      }));
      return project;
    } catch (e) {
      set({ importing: false });
      throw e;
    }
  },

  // ─── UI State ──────────────────────────────────────────────────────────────
  activePage: 'library',
  setActivePage: (page) => set({ activePage: page }),

  draggedSample: null,
  setDraggedSample: (sample) => set({ draggedSample: sample }),
}));

export default useStore;
