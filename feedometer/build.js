/**
 * FeedOmeter Production Minification & Mangling Build Pipeline
 * Optimizes CSS and JavaScript for lightning-fast Core Web Vitals and source protection.
 */
const fs = require('fs');
const path = require('path');

let minifyJs, CleanCSS;
try {
  minifyJs = require('terser').minify;
  CleanCSS = require('clean-css');
} catch (e) {
  const scratchModules = 'C:/Users/ravik/.gemini/antigravity/brain/30e75e41-d67f-4d74-b14a-5520794a9e49/scratch/node_modules';
  minifyJs = require(path.join(scratchModules, 'terser')).minify;
  CleanCSS = require(path.join(scratchModules, 'clean-css'));
}

const ROOT = __dirname;
const cleanCssInstance = new CleanCSS({
  level: {
    1: { specialComments: 0 },
    2: { mergeMedia: true, removeEmpty: true, removeDuplicateRules: true }
  }
});

async function build() {
  console.log('🚀 Starting FeedOmeter Production Minification & Build...');
  const results = [];

  // 1. Minify CSS
  const cssFiles = [
    'styles/feedometer.css',
    'styles/feedometer-reader.css',
    'styles/auth.css',
    'styles/settings-modal.css',
    'styles/search.css',
    'styles/widgets-studio.css',
    'styles/filters-page.css',
    'navbar/navbar.css',
    'globalsearch/global-search.css',
    'favbar/favbar.css'
  ];
  for (const relCss of cssFiles) {
    const cssPath = path.join(ROOT, relCss);
    const minCssPath = cssPath.replace(/\.css$/, '.min.css');
    if (fs.existsSync(cssPath)) {
      const rawCss = fs.readFileSync(cssPath, 'utf8');
      const minified = cleanCssInstance.minify(rawCss);
      fs.writeFileSync(minCssPath, minified.styles, 'utf8');
      results.push({
        file: relCss.replace(/\.css$/, '.min.css'),
        rawBytes: Buffer.byteLength(rawCss),
        minBytes: Buffer.byteLength(minified.styles)
      });
    }
  }

  // 2. Minify JS Files
  const jsFiles = [
    'scripts/feedometer-config.js',
    'scripts/feedometer-auth.js',
    'scripts/feedometer-reader.js',
    'scripts/feedometer-viewer.js',
    'scripts/bg-color-picker.js',
    'scripts/feedometer-telemetry.js',
    'scripts/feedometer-builder.js',
    'scripts/feedometer-add-source.js',
    'scripts/feedometer-widgets.js',
    'scripts/feedometer-filters.js',
    'scripts/smart-crop.js',
    'scripts/feed-imaging.js',
    'scripts/feedometer-search.js',
    'boolean-parser/boolean-parser.js',
    'navbar/navbar.js',
    'globalsearch/global-search.js'
  ];

  const bundleParts = [];

  for (const relPath of jsFiles) {
    const fullPath = path.join(ROOT, relPath);
    if (fs.existsSync(fullPath)) {
      const rawJs = fs.readFileSync(fullPath, 'utf8');
      const outPath = fullPath.replace(/\.js$/, '.min.js');
      
      const terserResult = await minifyJs(rawJs, {
        ecma: 2020,
        compress: {
          drop_console: false,
          drop_debugger: true,
          pure_funcs: []
        },
        mangle: {
          toplevel: false
        },
        format: {
          comments: false
        }
      });

      if (terserResult.code) {
        fs.writeFileSync(outPath, terserResult.code, 'utf8');
        results.push({
          file: relPath.replace(/\.js$/, '.min.js'),
          rawBytes: Buffer.byteLength(rawJs),
          minBytes: Buffer.byteLength(terserResult.code)
        });

        if (!relPath.includes('builder')) {
          bundleParts.push(terserResult.code);
        }
      }
    }
  }

  // 3. Consolidated Production Bundle
  if (bundleParts.length > 0) {
    const bundleContent = bundleParts.join(';\n');
    const bundlePath = path.join(ROOT, 'scripts', 'feedometer.bundle.min.js');
    fs.writeFileSync(bundlePath, bundleContent, 'utf8');
    const totalRaw = results.filter(r => !r.file.includes('css') && !r.file.includes('builder')).reduce((acc, r) => acc + r.rawBytes, 0);
    results.push({
      file: 'scripts/feedometer.bundle.min.js',
      rawBytes: totalRaw,
      minBytes: Buffer.byteLength(bundleContent)
    });
  }

  console.log('\n📊 PRODUCTION BUILD SUMMARY:');
  console.log('----------------------------------------------------------------------');
  console.log('Asset File                          Original     Minified    Reduction');
  console.log('----------------------------------------------------------------------');
  let totalRawAll = 0;
  let totalMinAll = 0;
  results.forEach(r => {
    const origKb = (r.rawBytes / 1024).toFixed(1) + ' KB';
    const minKb = (r.minBytes / 1024).toFixed(1) + ' KB';
    const pct = (((r.rawBytes - r.minBytes) / r.rawBytes) * 100).toFixed(1) + '%';
    console.log(r.file.padEnd(35) + origKb.padEnd(13) + minKb.padEnd(12) + '-' + pct);
    if (!r.file.includes('bundle')) {
      totalRawAll += r.rawBytes;
      totalMinAll += r.minBytes;
    }
  });
  console.log('----------------------------------------------------------------------');
  const overallPct = (((totalRawAll - totalMinAll) / totalRawAll) * 100).toFixed(1);
  console.log('TOTAL PAYLOAD SAVINGS:              ' + (totalRawAll / 1024).toFixed(1) + ' KB   →   ' + (totalMinAll / 1024).toFixed(1) + ' KB  (-' + overallPct + '%)');
  console.log('----------------------------------------------------------------------');
  console.log('✅ Production build completed successfully!\n');
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
