// Map view route wrapper
import { state } from '../state.js';
import { createMapView } from '../components/map.js';

export function renderMap(params) {
  // Optional selected outlet id in route: #/map/:id
  const selectedOutletId = params && params.length ? params[0] : state.getMapSelectedOutletId();

  // Prefer last filtered outlets captured from list; fallback to compute now
  let outlets = state.getLastFiltered();
  if (!outlets || outlets.length === 0) {
    const session = state.getSession();
    const { all } = state.getOutletsForAgent(session.agentId);
    const f = state.getFilters();
    outlets = all.filter(s => {
      if (f.search && !s.outlet_name.toLowerCase().includes(f.search.toLowerCase())) return false;
      if (f.community && s.community !== f.community) return false;
      if (f.assembly && s.assembly !== f.assembly) return false;
      if (f.outlet_type && s.outlet_type !== f.outlet_type) return false;
      return true;
    });
  }

  // Open the map overlay
  createMapView(outlets, (outlet) => {
    const outletId = outlet.captured_id || outlet.assigned_outlet_id;
    state.setMapSelectedOutletId(outletId);
    window.location.hash = `#/detail/${outletId}`;
  }, {
    selectedOutletId,
    onClose: () => {
      // Always go back to list when closing map
      window.location.hash = '#/list';
    }
  });
}
