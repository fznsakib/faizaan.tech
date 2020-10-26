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
        <Head title="Home">
          <link>
            rel="stylesheet"
            type="text/css"
            charset="UTF-8"
            href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.6.0/slick.min.css"
          </link>
          <link>
            rel="stylesheet"
            type="text/css"
            href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.6.0/slick-theme.min.css"
          </link>
        </Head>
        <div className={indexStyles.blocks}>
          <NameBlock></NameBlock>
          <ColourBlock></ColourBlock>
          <IconBar resume_url={resume_url}></IconBar>
        </div>
      </Layout>
    </div>
  );
}
