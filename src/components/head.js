import React from "react";
import { Helmet } from "react-helmet";
import { useStaticQuery, graphql } from "gatsby";

export default function Head({ title }) {
  const data = useStaticQuery(graphql`
    query {
      site {
        siteMetadata {
          title
          description
        }
      }
    }
  `);

  return (
    <Helmet 
      title={`${title} | ${data.site.siteMetadata.title}`}
      meta={[
        { name: 'charSet', content: 'utf-8' },
        { name: 'description', content: data.site.siteMetadata.description },
        { name: 'keywords', content: 'Faizaan, Sakib, software, engineer, computer, science, UK, England, backend, development, portfolio, blog' },
        { property: 'og:type', content: 'website' }
      ]}
    >
        <html lang="en" />
    </Helmet>
  );
}
