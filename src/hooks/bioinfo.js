import { useStaticQuery, graphql } from "gatsby";

export default function BioInfo() {
    const info = useStaticQuery(graphql`
        query {
            allContentfulBioInfo ( sort: {fields: id, order: ASC} ) {
                edges {
                node {
                    title 
                    body {
                        body
                    }
                    icon {
                        file {
                            url
                        }
                    }
                }
                }
            }
        }
    `);

    return info.allContentfulBioInfo.edges;
};
