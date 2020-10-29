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
        }
      }
    }
  `);

  return (
    <Helmet title={`${title} | ${data.site.siteMetadata.title}`}>
        <html lang="en" />
        <meta charSet="utf-8" />
        <title>Faizaan Sakib | Software Engineer</title>
        <meta name='description'>Recent masters graduate in Computer Science specialising in back-end development based in the UK. Come find out more about me and the projects I have been involved with!</meta>
        <JsonLd>
          {{
            '@context': 'https://schema.org',
            '@type': 'Portfolio',
            url: 'http://faizaan.tech',
            name: 'Faizaan Sakib | Software Engineer',
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
