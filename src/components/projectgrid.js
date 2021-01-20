import React, { Component } from "react";

import ProjectTypeSelector from "../components/projecttypeselector";
import PersonalProjects from "../hooks/personalprojects";
import PersonalProjectGridBox from "../templates/personalprojectgridbox";
import WorkProjects from "../hooks/workprojects";
import WorkProjectGridBox from "../templates/workprojectgridbox";

import projectGridStyles from "./projectgrid.module.scss";

class ProjectGrid extends Component {
  constructor(props) {
    super(props);
    this.state = { showPersonal: true };
  }

  triggerProjectTypeState = () => {
    this.setState({
      ...this.state,
      showPersonal: !this.state.showPersonal,
    });
  };

  // Create all grid items for personal and work projects.
  // Show items depending on the state of the project type selector.
  render() {
    const personalProjects = PersonalProjects();
    const workProjects = WorkProjects();

    return (
      <div>
        <ProjectTypeSelector
          state={this.state.showPersonal}
          trigger={this.triggerProjectTypeState}
        ></ProjectTypeSelector>
        <div className={projectGridStyles.container}>
          {this.state.showPersonal &&
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
            ))}

          {!this.state.showPersonal &&
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
            ))}
        </div>
      </div>
    );
  }
}

export default ProjectGrid;
