interface ManifestShortcutIcon extends ManifestIconCommon {
  purpose: string;
  type: string;
}

interface ManifestIconCommon {
  src: string;
  sizes: string;
}

interface ManifestIcon extends ManifestIconCommon {
  type?: string;
  purpose?: string;
}

interface ManifestScreenshot {
  src: string;
  sizes: string;
  type: string;
}

interface ManifestShortcut {
  name: string;
  url: string;
  description: string;
  icons: ManifestShortcutIcon[];
}

interface ManifestRelatedApplication {
  platform: string;
  url: string;
  id: string;
}

interface Manifest {
  name: string;
  short_name: string;
  version: string;
  description: string;
  categories: string[];
  offline_enabled: boolean;
  start_url: string;
  display: string;
  orientation: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
  shortcuts: ManifestShortcut[];
  screenshots: ManifestScreenshot[];
  related_applications: ManifestRelatedApplication[];
  prefer_related_applications: boolean;
}
