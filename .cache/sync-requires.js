const { hot } = require("react-hot-loader/root")

// prefer default export if available
const preferDefault = m => m && m.default || m


exports.components = {
  "component---cache-dev-404-page-js": hot(preferDefault(require("/Users/faizaan/Documents/Projects/faizaansakib.xyz/.cache/dev-404-page.js"))),
  "component---src-pages-about-js": hot(preferDefault(require("/Users/faizaan/Documents/Projects/faizaansakib.xyz/src/pages/about.js"))),
  "component---src-pages-blog-js": hot(preferDefault(require("/Users/faizaan/Documents/Projects/faizaansakib.xyz/src/pages/blog.js"))),
  "component---src-pages-index-js": hot(preferDefault(require("/Users/faizaan/Documents/Projects/faizaansakib.xyz/src/pages/index.js"))),
  "component---src-pages-music-js": hot(preferDefault(require("/Users/faizaan/Documents/Projects/faizaansakib.xyz/src/pages/music.js"))),
  "component---src-pages-projects-js": hot(preferDefault(require("/Users/faizaan/Documents/Projects/faizaansakib.xyz/src/pages/projects.js")))
}

