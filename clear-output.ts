import { readdir, unlink } from 'fs/promises';
import { resolve } from 'path';

async function clearOutputFolder() {
  const outputDir = resolve(process.cwd(), 'output');
  try {
    const files = await readdir(outputDir);
    await Promise.all(
      files.map(async (file) => {
        const filePath = resolve(outputDir, file);
        await unlink(filePath);
      })
    );
    console.log('Cleared all files in output/');
  } catch (err) {
    if ((err as any).code === 'ENOENT') {
      // output folder does not exist, nothing to do
      console.log('output/ folder does not exist.');
    } else {
      throw err;
    }
  }
}

if (require.main === module) {
  clearOutputFolder();
}

export { clearOutputFolder };
