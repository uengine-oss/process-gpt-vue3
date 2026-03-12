const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 120;
const HORIZONTAL_GAP = 36;
const VERTICAL_GAP = 56;

function cloneNode(node) {
    return JSON.parse(JSON.stringify(node));
}

function transformForVerticalLayout(node) {
    if (!node) return node;

    const clonedNode = cloneNode(node);

    if (clonedNode.children && clonedNode.children.length > 0) {
        clonedNode.children = clonedNode.children.map((child) => {
            const transformedChild = transformForVerticalLayout(child);

            if (
                transformedChild.data &&
                transformedChild.data.isTeam &&
                transformedChild.children &&
                transformedChild.children.length > 0
            ) {
                const teamId = transformedChild.id;

                transformedChild.children.forEach((member) => {
                    const originalId = member.id;
                    member.id = `${teamId}__${originalId}`;
                    member.data.renderNodeId = `${teamId}__${originalId}`;
                    member.data.originalId = originalId;
                });

                const members = transformedChild.children;
                if (members.length > 1) {
                    for (let i = 0; i < members.length - 1; i++) {
                        members[i].children = [members[i + 1]];
                    }
                    members[members.length - 1].children = [];
                    transformedChild.children = [members[0]];
                }
            }

            return transformedChild;
        });
    }

    return clonedNode;
}

function subtreeWidth(node) {
    if (!node?.children?.length) {
        return DEFAULT_NODE_WIDTH;
    }

    const childrenWidth = node.children.reduce((sum, child, index) => {
        const width = subtreeWidth(child);
        return sum + width + (index > 0 ? HORIZONTAL_GAP : 0);
    }, 0);

    return Math.max(DEFAULT_NODE_WIDTH, childrenWidth);
}

function layoutTree(node, depth, left, placedNodes, placedEdges, resolveUserData, searchQuery) {
    const width = subtreeWidth(node);
    const x = left + width / 2 - DEFAULT_NODE_WIDTH / 2;
    const y = depth * (DEFAULT_NODE_HEIGHT + VERTICAL_GAP);
    const nodeData = node.data || node;
    const resolvedUser = resolveUserData(nodeData);
    const originalId = nodeData.originalId || nodeData.id || node.id;
    const label = resolvedUser.username || resolvedUser.name || nodeData.name || node.id;
    const matchesSearch = Boolean(searchQuery) && label.toLowerCase().includes(searchQuery.toLowerCase());

    placedNodes.push({
        id: node.id,
        type: nodeData.isTeam ? 'team' : node.id === 'root' ? 'root' : 'member',
        position: { x, y },
        data: {
            nodeId: node.id,
            originalId,
            rawNode: node,
            userData: resolvedUser,
            isRoot: node.id === 'root',
            isTeam: Boolean(nodeData.isTeam),
            isAgent: Boolean(nodeData.isAgent || resolvedUser.isAgent),
            matchesSearch
        },
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT
    });

    if (!node.children?.length) {
        return width;
    }

    let cursor = left;
    for (const child of node.children) {
        const childWidth = subtreeWidth(child);
        layoutTree(child, depth + 1, cursor, placedNodes, placedEdges, resolveUserData, searchQuery);
        placedEdges.push({
            id: `${node.id}->${child.id}`,
            source: node.id,
            target: child.id,
            type: 'smoothstep'
        });
        cursor += childWidth + HORIZONTAL_GAP;
    }

    return width;
}

export function buildOrganizationChartFlow(rootNode, resolveUserData, searchQuery = '') {
    if (!rootNode) {
        return { nodes: [], edges: [], transformedRoot: null };
    }

    const transformedRoot = transformForVerticalLayout(rootNode);
    const nodes = [];
    const edges = [];
    layoutTree(transformedRoot, 0, 0, nodes, edges, resolveUserData, searchQuery.trim());

    return { nodes, edges, transformedRoot };
}
