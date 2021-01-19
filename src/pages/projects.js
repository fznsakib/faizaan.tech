import React from "react";

import Head from "../components/head";
import ScrollableLayout from "../components/scrollablelayout";
import ProjectContent from "../components/projectcontent";

import projectsStyles from "./projects.module.scss";

export default function Projects() {
  return (
    <div>
      <ScrollableLayout>
        <Head title="Projects" />
        <main className={projectsStyles.section}>
          <div>
            <h1 className={projectsStyles.title}>projects</h1>
            <div className={projectsStyles.underline}></div>
          </div>
          <ProjectContent></ProjectContent>
        </main>
      </ScrollableLayout>
    </div>
  );
}
