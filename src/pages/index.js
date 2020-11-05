import React from "react";

import Layout from "../components/layout";
import Head from "../components/head";
import Intro from "../components/intro";
import IconBar from "../components/iconbar";

import { ResumeURL } from "../hooks/resumeurl";

import indexStyles from "./index.module.scss";

export default function Home() {
  const resume_url = ResumeURL();
  return (
    <div>
      <Layout>
        <Head title="Home"></Head>
        <main className={indexStyles.blocks}>
          <Intro></Intro>
          <div className={indexStyles.iconBar}>
            <IconBar resume_url={resume_url}></IconBar>
          </div>
        </main>
      </Layout>
    </div>
  );
}
