import React, { useEffect } from 'react';
import MarkdownIt from 'markdown-it';
import Prism from 'prismjs';

const md = new MarkdownIt({
  html: true,
  linkify: false,
});

export default function CodeSnippet({ markdown }) {
  useEffect(() => {
    Prism.highlightAll();
  });

  console.log(markdown);

  return (
    <div dangerouslySetInnerHTML={{ __html: md.render(markdown) }} />
  );
};

