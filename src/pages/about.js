import React from "react";
import Img from "gatsby-image";

import ScrollableLayout from "../components/scrollablelayout";
import Head from "../components/head";
import SkillGrid from "../components/skillgrid";
import ProfilePicture from "../hooks/profilepicture";

import aboutStyles from "./about.module.scss";

export default function About() {
  const profilePicture = ProfilePicture();

  return (
    <div>
      <ScrollableLayout>
        <Head title="About Me" />
        <div
          className={aboutStyles.profilePicture}
          data-sal="zoom-out"
          data-sal-duration="1000"
          data-sal-easing="ease"
        >
          <Img fixed={profilePicture} alt="Faizaan" />
        </div>
        <main id={aboutStyles.aboutSection}>
          <h1
            className={aboutStyles.title}
            data-sal="zoom-out"
            data-sal-duration="1000"
            data-sal-easing="ease"
          >
            about me
          </h1>
          <div
            className={aboutStyles.underline}
            data-sal="zoom-out"
            data-sal-duration="1000"
            data-sal-easing="ease"
          ></div>
          <p
            className={aboutStyles.text}
            data-sal="zoom-out"
            data-sal-duration="1000"
            data-sal-easing="ease"
          >
            I am currently working at PolyAI in London. I work as a full-stack
            engineer on a low-code platform which allows users to build and
            maintain their own customer service voice assistants powered by AI.
            Get in touch with me on{" "}
            <a
              href="https://www.linkedin.com/in/faizaan-sakib"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn!
            </a>
          </p>
        </main>
        <main id={aboutStyles.skillsSection}>
          <h1
            className={aboutStyles.subtitle}
            data-sal="zoom-out"
            data-sal-duration="1000"
            data-sal-easing="ease"
          >
            skills
          </h1>
          <div
            className={aboutStyles.underline}
            data-sal="zoom-out"
            data-sal-duration="1000"
            data-sal-easing="ease"
          ></div>
          <SkillGrid></SkillGrid>
        </main>
      </ScrollableLayout>
    </div>
  );
}
