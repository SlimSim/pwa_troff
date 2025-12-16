import { MarkerColorConfig } from '../types/markers.js';
import { MARKER_COLORS } from '../constants/constants.js';

export const setBgCustom = (target: HTMLElement, color: MarkerColorConfig) => {
  target.classList.toggle('bg-custom', color.color !== '');
  target.style.setProperty('--bg-custom-color', color.color);
  target.style.setProperty('--on-bg-custom-color', color.onColor);
};

export const getBgColor = (color: string | undefined): MarkerColorConfig => {
  if (!color) {
    return { name: 'None', color: '', onColor: '' };
  }
  const colorObject = MARKER_COLORS.find((config) => config.color === color);

  if (colorObject) {
    return colorObject;
  }

  const colorName = color.replace(/^bg-/, '').replace(/-/g, ' ');

  const secondColorObject = MARKER_COLORS.find((config) => config.name.toLowerCase() === colorName);

  if (secondColorObject) {
    return secondColorObject;
  }

  switch (color) {
    case 'bg-white-1':
      return { name: 'White', color: '#ffffff', onColor: '#333' };
    case 'bg-white-2':
      return { name: 'Gray 1', color: '#f6f5f4', onColor: '#000' };
    case 'bg-white-3':
      return { name: 'Gray 2', color: '#deddda', onColor: '#000' };
    case 'bg-white-4':
      return { name: 'Gray 3', color: '#c0bfbc', onColor: '#000' };
    case 'bg-white-5':
      return { name: 'Gray 4', color: '#9a9996', onColor: '#000' };
    case 'bg-black-1':
      return { name: 'Gray 5', color: '#77767b', onColor: '#000' };
    case 'bg-black-2':
      return { name: 'Gray 6', color: '#5e5c64', onColor: '#f6f5f4' };
    case 'bg-black-3':
      return { name: 'Gray 7', color: '#3d3846', onColor: '#f6f5f4' };
    case 'bg-black-4':
      return { name: 'Gray 8', color: '#241f31', onColor: '#f6f5f4' };
    case 'bg-black-5':
      return { name: 'Black', color: '#000000', onColor: '#f6f5f4' };
    default:
      return { name: 'None', color: '', onColor: '' };
  }
};
