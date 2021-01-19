import React from "react";

// import ProjectGridBox from "../templates/projectgridbox";
import Projects from "../hooks/projects";
import ProjectGridBox from "../templates/projectgridbox";
import projectGridStyles from "./projectgrid.module.scss";

export default function ProjectGrid() {
  const projects = Projects();

  return (
    <div className={projectGridStyles.container}>
      {projects.map((project, i) => (
        <ProjectGridBox
          name={project.node.name}
          type={project.node.type}
          tags={project.node.tags}
          github={project.node.github}
          website={project.node.website}
          image={project.node.image.file.url}
          key={i}
        ></ProjectGridBox>
      ))}
    </div>
  );
}
