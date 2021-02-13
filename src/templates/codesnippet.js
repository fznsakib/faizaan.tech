import React, { useEffect } from 'react';
import Prism from 'prismjs';

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

