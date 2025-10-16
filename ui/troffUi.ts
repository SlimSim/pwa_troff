export function markersExist(): boolean {
  var aOMarkers = $('#markerList > li > :nth-child(3)');
  if (aOMarkers.length === 0) {
    return false;
  }
  return true;
}
