import templateParser from './utils/templateParser';
import templateBuilder from './utils/templateBuilder';
/**
 * build a new array by joining given arrays
 * @param {Array} values - priority based order
 * @param {Array} prevContributors - contributors list of previous readme
 * @param {Array} contributors - current contributors
 * @param {Array} collaborators - current colloborators
 * @param {Array} bots - current bots
 * @param {Array} sponsors - current sponsors
 * @returns {Array} prdered list
 */
const joinArray = (values, prevContributors, contributors, collaborators, bots, sponsors) => {
    let joinedArray = [];

    values.forEach(category => {
        // checks the command and parses it eg: contributors,akhilmhdh|-
        category = category.trim().toLowerCase();
        const [category_type, operator] = category.split('/'); // category is like akhilmhdh/-

        switch (category_type.trim()) {
            case 'contributors':
                joinedArray = joinedArray.concat(contributors);
                break;
            case 'collaborators':
                joinedArray = joinedArray.concat(collaborators);
                break;
            case 'bots':
                joinedArray = joinedArray.concat(bots);
                break;
            case 'sponsors':
                joinedArray = joinedArray.concat(sponsors);
                break;
            default:
                prevContributors[category_type]
                    ? joinedArray.push({
                          login: category_type,
                          avatar_url: prevContributors[category_type].url,
                          name: prevContributors[category_type].name
                      })
                    : joinedArray.push({ login: category_type });
                break;
        }
        // operators mutation
        if (operator) {
            switch (operator.trim()) {
                case '-': {
                    joinedArray = joinedArray.filter(({ login }) => login !== category_type);
                    break;
                }
                default:
                    break;
            }
        }
    });

    return joinedArray;
};

const buildContent = async (
    templateContent,
    contributors,
    collaborators,
    bots,
    sponsors,
    content
) => {
    /**
     * regex expression to parse the options passed inside the readme tags
     * eg: <!-- readme:contributors,bots -start --!> anything inside this<!-- readme:contributors,bots -end --!>
     * using the regex we get two groups return as
     *  type: contributors,bots, collobortors, sponsors
     *      use: to get the options passed
     *  content: anything that was inside the tag
     *      use: to reuse the html created inside the tah
     */
    // get prev contributors in the readme
    // Just another comment to keep github contribution streak
    let prevReadmeContributorsTemplate = templateContent.match(
        /<!--\s*readme:(?<type>[\s\S]*?)-start\s*-->(?<content>[\s\S]*?)<!--\s*readme:[\s\S]*?-end\s*-->/
    );
    const prevContributors = templateParser(prevReadmeContributorsTemplate.groups.content);
    const types = prevReadmeContributorsTemplate.groups.type.split(',');
    const contributorsPool = joinArray(
        types,
        prevContributors,
        contributors,
        collaborators,
        bots,
        sponsors
    );

    let contributors_content = await templateBuilder(
        contributorsPool,
        prevContributors,
        prevReadmeContributorsTemplate.groups.type
    );

    /**
     * Build back the new template
     * replace it with the old one
     */
    const re = new RegExp(
        `<!--\\s*readme:\\s*${prevReadmeContributorsTemplate.groups.type}\\s*-start\\s*-->([\\s\\S]*?)<!--\\s*readme:\\s*${prevReadmeContributorsTemplate.groups.type}\\s*-end\\s*-->`
    );
    const postprocess_content = content.replace(re, contributors_content);
    return postprocess_content;
};

export default buildContent;
