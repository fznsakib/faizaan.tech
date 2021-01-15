import React from "react";
import ScrollableLayout from "../components/scrollablelayout";
import Head from "../components/head";

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
        </main>
      </ScrollableLayout>
    </div>
  );
}
