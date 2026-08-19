import { useStore } from '../store';
import { Split } from '../components/Split';
import { Panel } from '../components/ui';
import { XmlEditor } from '../components/XmlEditor';
import { SkeletonTree } from '../components/SkeletonTree';
import { NodeInspector } from '../components/NodeInspector';

// Three panes, resizable, all bound to the same document: the XML source, the
// skeleton tree, and the node inspector.
export function SetupPage() {
  const xmlErrors = useStore((s) => s.xmlErrors);

  return (
    <Split
      direction="vertical"
      initial={68}
      min={35}
      max={85}
      a={
        <Split
          direction="horizontal"
          initial={38}
          a={
            <Panel
              title="XML source"
              right={
                <span className="chip text-[#8A8F98]">
                  {xmlErrors.length === 0
                    ? 'parsed'
                    : `${xmlErrors.length} error${xmlErrors.length === 1 ? '' : 's'}, last valid document kept`}
                </span>
              }
              className="h-full border-r border-[#D8D9D4]"
              bodyClassName="overflow-hidden"
            >
              <XmlEditor />
            </Panel>
          }
          b={
            <Panel
              title="skeleton (N, →)"
              className="h-full"
              bodyClassName="overflow-hidden"
            >
              <SkeletonTree />
            </Panel>
          }
        />
      }
      b={<NodeInspector />}
    />
  );
}
