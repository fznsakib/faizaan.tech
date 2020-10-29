import React from "react";
import { Helmet } from "react-helmet";
import { useStaticQuery, graphql } from "gatsby";

export default function JsonLd({ children }) {

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(children)}</script>
    </Helmet>
  );
}
