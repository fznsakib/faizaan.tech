import React from "react";
import Layout from "../components/layout";
import Head from "../components/head";
import ColourBlock from "../components/colourblock";
import NameBlock from "../components/nameblock";
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
          <h1 className={indexStyles.pageTitleMain}>faizaan sakib</h1>
          <h1>software engineer</h1>
          <NameBlock></NameBlock>
          <ColourBlock></ColourBlock>
          <IconBar resume_url={resume_url}></IconBar>
        </div>
      </Layout>
    </div>
  );
}
