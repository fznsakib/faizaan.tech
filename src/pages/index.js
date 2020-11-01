import React from "react";

import Layout from "../components/layout";
import Head from "../components/head";
import IconBar from "../components/iconbar";

import { ResumeURL } from "../hooks/resumeurl";

import indexStyles from "./index.module.scss";

export default function Home() {
  const resume_url = ResumeURL();
  return (
    <div>
      <Layout>
        <Head title="Home"></Head>
        <div className={indexStyles.blocks}>
          <h1 className={indexStyles.name}>faizaan sakib</h1>
          <h1 className={indexStyles.job}>software engineer</h1>
          <IconBar resume_url={resume_url}></IconBar>
        </div>
      </Layout>
    </div>
  );
}
