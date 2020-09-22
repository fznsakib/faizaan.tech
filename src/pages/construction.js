import React from "react";
import { Link } from "gatsby";

import Layout from "../components/layout";
import Head from "../components/head";
import constructionStyles from "./construction.module.scss";

export default function Construction() {
  return (
    <Layout>
      <Head title="Page under construction" />
      <div className={constructionStyles.container}>
        <h1 className={constructionStyles.block}>Sorry!</h1>
        <img height="120vw" src={'/construction.svg'} alt="Page under construction"/>
        <h2 className={constructionStyles.block}>I'm currently working on this page. It'll be available soon! <span role="img" aria-label="eyes">👀</span></h2>
        <p className={constructionStyles.block}>
            <Link to="/">back to homepage</Link>
        </p>
      </div>
    </Layout>
  );
}
