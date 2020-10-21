import React from "react";
import ScrollableLayout from "../components/scrollablelayout";
import Head from "../components/head";
import Intro from "../components/intro";

import aboutStyles from "./about.module.scss"

export default function About() {
  return (
    <div>
      <ScrollableLayout>
        <Head title="About Me" />
        <Intro></Intro>
        <p className={aboutStyles.text}>I recently graduated from the University of Bristol with a Masters graduate in Computer Science (MEng), achieving First Class honours. Right now, I’m on the lookout for exciting opportunities in software engineering. Get in touch with me on LinkedIn!</p>
        <p className={aboutStyles.text}>During my time at university, along with software engineering internships, I have enjoyed working on many projects, aimed at solving all sorts of problems using different technologies. This has given me a strong breadth of skills, having had experience working in areas of computer vision, cloud computing, web development, VR, blockchain and deep learning, just to name a few. Through this, I have developed a keen attitude to constantly learn new technologies and be able to quickly adapt where necessary.</p>
      </ScrollableLayout>
    </div>
  );
}
