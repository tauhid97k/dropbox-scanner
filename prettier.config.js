//  @ts-check

/** @type {import('prettier').Config} */
const config = {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  tailwindStylesheet: './src/styles.css',
  tailwindFunctions: ['cva', 'cn'],
  plugins: ['prettier-plugin-organize-imports', 'prettier-plugin-tailwindcss'],
}

export default config
