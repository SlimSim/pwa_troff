import { MARKER_COLORS } from '../constants/constants.js';

export function markersExist(): boolean {
  var aOMarkers = $('#markerList > li > :nth-child(3)');
  if (aOMarkers.length === 0) {
    return false;
  }
  return true;
}

export function updateHtmlMarkerColor(li: HTMLElement, colorName: string) {
  const colorConfig = MARKER_COLORS.find((c) => c.name === colorName);
  if (colorConfig && colorName !== 'None') {
    li.classList.add('markerColor');
    li.dataset.markerColor = colorConfig.color;
    li.dataset.markerOnColor = colorConfig.onColor;
  } else {
    li.classList.remove('markerColor');
    li.dataset.markerColor = '';
    li.dataset.markerOnColor = '';
  }
}

export function setCssVariablesForMarkerDistanceAndColor(
  child: HTMLElement,
  onlyUpdateColors: boolean,
  timeBarHeight: number,
  songTime: number,
  totalDistanceTop: number,
  barMarginTop: number
) {
  let markerColor = null;
  let markerOnColor = null;
  let previousMarkerColor = null;
  let previousActiveMarkerColor = null;
  let previousActiveOnMarkerColor = null;
  while (child) {
    if (!onlyUpdateColors) {
      const markerTime = Number((child.childNodes[2] as any).timeValue || $(child).data('time'));
      const myRowHeight = child.clientHeight;

      const freeDistanceToTop = (timeBarHeight * markerTime) / songTime;

      const marginTop = freeDistanceToTop - totalDistanceTop + barMarginTop;
      totalDistanceTop = freeDistanceToTop + myRowHeight + barMarginTop;

      if (marginTop > 0) {
        $(child).css('border-top-width', marginTop + 'px');
        $(child).css('border-top-style', 'solid');
        $(child).css('margin-top', '');
      } else {
        $(child).css('border-top-width', '');
        $(child).css('border-top-style', '');
        $(child).css('margin-top', marginTop + 'px');
      }
    }
    markerColor = child.dataset.markerColor || null;
    markerOnColor = child.dataset.markerOnColor || null;

    $(child)[0].style.setProperty('--marker-bg-color', markerColor);
    $(child)[0].style.setProperty('--marker-on-bg-color', markerOnColor);
    $(child)[0].style.setProperty('--marker-border-color', previousMarkerColor);
    $(child)[0].style.setProperty('--marker-active-color', previousActiveMarkerColor);
    $(child)[0].style.setProperty('--marker-active-on-color', previousActiveOnMarkerColor);

    child = child.nextSibling as HTMLElement;
    previousMarkerColor = markerColor;
    if (markerColor !== null) {
      previousActiveMarkerColor = markerColor;
      previousActiveOnMarkerColor = markerOnColor;
    }
  }
}
