import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
export default {
  root,
  resolve: {
    alias: {
      "@": `${root}client/src`,
      "@shared": `${root}shared`,
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["client/src/pages/alimentazione/Distribuzione.test.tsx"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
};
