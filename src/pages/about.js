import React from "react";
import ScrollableLayout from "../components/scrollablelayout";
import Head from "../components/head";

import aboutStyles from "./about.module.scss"

export default function About() {
  return (
    <div>
      <ScrollableLayout>
        <Head title="About Me" />
        <img className={aboutStyles.profilePicture} src={'/profile_picture.jpg'} alt="Faizaan"></img>
        <h1 className={aboutStyles.header}>about me</h1>
        <p className={aboutStyles.text}>I have recently graduated from the University of Bristol with a Masters in Computer Science (MEng), achieving first-class honours. Right now, I’m on the lookout for exciting opportunities in software engineering. Get in touch with me on LinkedIn!</p>
        <p className={aboutStyles.text}>I have enjoyed working on many projects, aimed at solving all sorts of problems using different technologies. This has given me a strong breadth of skills, with experience working in areas of cloud computing, web development, deep learning, VR, and blockchain, just to name a few. Through this, I have developed a keen attitude to constantly learn new technologies and be able to quickly adapt where necessary.</p>
      </ScrollableLayout>
    </div>
  );
}
