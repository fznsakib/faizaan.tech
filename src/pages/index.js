import React from "react";
import Layout from "../components/layout";
import Head from "../components/head";
import ColourBlock from "../components/colourblock";
import NameBlock from "../components/nameblock";
import IconBar from "../components/iconbar";

import { useResumeUrl } from "../hooks/useresumeurl";

import indexStyles from "./index.module.scss";

export default function Home() {
  const resume_url = useResumeUrl();
  return (
    <div>
      <Layout>
        <Head title="Home" />
        <div className={indexStyles.blocks}>
          <NameBlock></NameBlock>
          <ColourBlock></ColourBlock>
          <IconBar resume_url={resume_url}></IconBar>
        </div>
      </Layout>
    </div>
  );
}
