import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '../../convex/api': path.resolve(__dirname, 'src/convex/api.js'),
      '../../convex/dataModel': path.resolve(__dirname, 'src/convex/dataModel.d.ts'),
    }
  }
});
