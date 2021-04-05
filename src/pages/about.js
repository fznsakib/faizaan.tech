import React from "react";
import { graphql, useStaticQuery } from "gatsby";
import Img from "gatsby-image";

import ScrollableLayout from "../components/scrollablelayout";
import Head from "../components/head";
import SkillGrid from "../components/skillgrid";

import aboutStyles from "./about.module.scss";

export default function About() {
  const data = useStaticQuery(graphql`
    query {
      file(relativePath: { eq: "images/profile_picture.jpg" }) {
        childImageSharp {
          fixed(height: 280) {
            ...GatsbyImageSharpFixed
          }
        }
      }
    }
  `);

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
          <Img fixed={data.file.childImageSharp.fixed} alt="Faizaan" />
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
            I have recently graduated from the University of Bristol with a
            Masters in Computer Science (MEng), achieving first-class honours.
            Right now, I’m on the lookout for exciting opportunities in software
            engineering. Get in touch with me on{" "}
            <a
              href="https://www.linkedin.com/in/faizaan-sakib"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn!
            </a>
          </p>
          <p
            className={aboutStyles.text}
            data-sal="zoom-out"
            data-sal-duration="1000"
            data-sal-easing="ease"
          >
            I have enjoyed working on many projects, aimed at solving all sorts
            of problems using different technologies. This has given me a strong
            breadth of skills, with experience working in areas of cloud
            computing, web development, deep learning, VR, and blockchain, just
            to name a few. Through this, I have developed a keen attitude to
            constantly learn new technologies and be able to quickly adapt where
            necessary.
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
