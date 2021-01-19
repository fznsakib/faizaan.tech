import React, { Component } from "react";

import ProjectGrid from "../components/projectgrid";
import BioGrid from "../components/biogrid"
import ProjectTypeSelector from "../components/projecttypeselector"

class ProjectContent extends Component {
    constructor(props) {
      super(props)
      this.state = { showPersonal: true }
    }
  
    triggerProjectTypeState = () => {
      this.setState({
        ...this.state,
        showPersonal: !this.state.showPersonal
      })
    }

    render() {
        return(
            <div>
                <ProjectTypeSelector state={this.state.showPersonal} trigger={this.triggerProjectTypeState}></ProjectTypeSelector>
                {this.state.showPersonal && <ProjectGrid/>}
                {!this.state.showPersonal && <BioGrid/>}
            </div>
        )
    }
}

export default ProjectContent;