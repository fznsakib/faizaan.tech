import React from "react";

// import ProjectGridBox from "../templates/projectgridbox";
import Projects from "../hooks/projects";
import ProjectGridBox from "../templates/projectgridbox";
import projectGridStyles from "./biogrid.module.scss";

export default function ProjectGrid() {
  const projects = Projects();

  return (
    <div className={projectGridStyles.container}>
      {projects.map((project, i) => (
        <ProjectGridBox
          name={project.node.name}
          field={project.node.field}
          year={project.node.year}
          url={project.node.url}
          technologies={project.node.technologies}
          image={project.node.previewImage.file.url}
          key={i}
        ></ProjectGridBox>
      ))}
    </div>
  );
}
