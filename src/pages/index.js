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
          <h1 className={indexStyles.name} data-sal="slide-down" data-sal-duration="1000" data-sal-easing="ease">faizaan sakib</h1>
          <h1 className={indexStyles.job} data-sal="slide-down" data-sal-duration="1000" data-sal-delay="500" data-sal-easing="ease">software engineer</h1>
          <div className={indexStyles.iconBar} data-sal="slide-down" data-sal-duration="1000" data-sal-delay="1000" data-sal-easing="ease">
            <IconBar resume_url={resume_url}></IconBar>
          </div>
        </div>
      </Layout>
    </div>
  );
}
