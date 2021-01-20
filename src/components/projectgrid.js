import React from "react";

import PersonalProjects from "../hooks/personalprojects";
import PersonalProjectGridBox from "../templates/personalprojectgridbox";
import WorkProjects from "../hooks/workprojects";
import WorkProjectGridBox from "../templates/workprojectgridbox";

import projectGridStyles from "./projectgrid.module.scss";

export default function ProjectGrid(props) {
  const personalProjects = PersonalProjects();
  const workProjects = WorkProjects();

  return (
    <div className={projectGridStyles.container}>

      {props.state && 
        personalProjects.map((project, i) => (
          <PersonalProjectGridBox
            name={project.node.name}
            type={project.node.type}
            tags={project.node.tags}
            github={project.node.github}
            website={project.node.website}
            image={project.node.image.file.url}
            key={i}
          />
        ))
      }

      {!props.state && 
        workProjects.map((project, i) => (
          <WorkProjectGridBox
            name={project.node.name}
            type={project.node.type}
            tags={project.node.tags}
            github={project.node.github}
            website={project.node.website}
            image={project.node.image.file.url}
            key={i}
          />
        ))
      }

    </div>
        
  );
}
