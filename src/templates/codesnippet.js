import React, { useEffect } from 'react';
import Prism from 'prismjs';

// Try markdownit

// Prism theme configuration
require("prismjs/themes/prism-custom.css");
// require("prismjs/themes/prism-duotonedark.css");
require("prismjs/plugins/line-numbers/prism-line-numbers.css");

// Prism language requirements
require('prismjs/components/prism-python');


export default function CodeSnippet({ markdown }) {
  useEffect(() => {
    Prism.highlightAll();
  });

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: markdown,
      }}
    ></div>
  );
};

