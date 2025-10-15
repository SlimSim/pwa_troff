export async function getManifest(): Promise<Manifest> {
  return new Promise((resolve, reject) => {
    fetch('manifest.json')
      .then((res) => res.json())
      .then((manifest) => {
        resolve(manifest);
      })
      .catch((error) => {
        reject(error);
      });
  });
}
