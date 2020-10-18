import React from "react";
import Layout from "../components/layout";
import Head from "../components/head";
import Intro from "../components/intro";

export default function About() {
  return (
    <div>
      <Layout>
        <Head title="About Me" />
        <Intro></Intro>
      </Layout>
    </div>
  );
}
