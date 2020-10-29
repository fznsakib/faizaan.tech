import React from "react";
import { Helmet } from "react-helmet";
import { useStaticQuery, graphql } from "gatsby";

import JsonLd from './jsonld.js'

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
        <JsonLd>
          {{
            '@context': 'https://schema.org',
            '@type': 'Portfolio',
            url: 'http://faizaan.tech',
            name: 'Faizaan Sakib',
            author: {
              '@type': 'Person',
              'name': 'Faizaan Sakib',
            },
            contactPoint: {
              '@type': 'ContactPoint',
              'email': 'fznsakib@gmail.com',
              'contactType': 'Personal'
            }
          }}
        </JsonLd>
    </Helmet>
  );
}
