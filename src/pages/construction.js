import React from "react";
import { Link, graphql, useStaticQuery } from "gatsby";
import Img from "gatsby-image"

import Layout from "../components/layout";
import Head from "../components/head";
import constructionStyles from "./construction.module.scss";

export default function Construction(props) {

  const data = useStaticQuery(graphql`
    query {
      file(relativePath: { eq: "images/construction.png" }) {
        childImageSharp {
          fixed(height: 120) {
            ...GatsbyImageSharpFixed
          }
        }
      }
    }
  `);

  return (
    <Layout>
      <Head title="Page under construction" />
      <div className={constructionStyles.container} data-sal="zoom-out" data-sal-duration="1000" data-sal-easing="ease">
        <h1 className={constructionStyles.block}>Sorry!</h1>
        <Img className={constructionStyles.image} fixed={data.file.childImageSharp.fixed} alt="Page under construction"/>
        <h2 className={constructionStyles.block}>I'm currently working on this page. It'll be available soon! <span role="img" aria-label="eyes">👀</span></h2>
        <p className={constructionStyles.block}>
            <Link to="/">back to homepage</Link>
        </p>
      </div>
    </Layout>
  );
}