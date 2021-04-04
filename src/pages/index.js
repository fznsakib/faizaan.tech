import React from "react";

import Layout from "../components/layout";
import Head from "../components/head";
import Intro from "../components/intro";
import IconBar from "../components/iconbar";

import indexStyles from "./index.module.scss";

export default function Home() {
  return (
    <div>
      <Layout>
        <Head title="Home"></Head>
        <main className={indexStyles.blocks}>
          <Intro></Intro>
          <IconBar className={indexStyles.iconBar}></IconBar>
        </main>
      </Layout>
    </div>
  );
}
