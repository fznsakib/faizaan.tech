import React from "react";
import Layout from "../components/layout";
import Head from "../components/head";
import ColourBlock from "../components/colourblock";
import NameBlock from "../components/nameblock";
import IconBar from "../components/iconbar";

import indexStyles from "./index.module.scss";

export default function Home() {
  return (
    <div>
      <Layout>
        <Head title="Home" />
        <div className={indexStyles.blocks}>
          <NameBlock></NameBlock>
          <ColourBlock></ColourBlock>
          <IconBar></IconBar>
        </div>
      </Layout>
    </div>
  );
}
