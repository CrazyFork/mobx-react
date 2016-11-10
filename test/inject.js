var React = require('react');
var enzyme = require('enzyme');
var mount = enzyme.mount;
var mobx = require('mobx');
var observer = require('../').observer;
var inject = require('../').inject;
var Provider = require('../').Provider;
var test = require('tape');
var e = React.createElement;

test('inject based context', t => {
    test('basic context', t => {
        var C = inject("foo")(observer(React.createClass({
            render: function() {
                return e("div", {}, "context:" + this.props.foo);
            }
        })));

        var B = React.createClass({
            render: function() {
                return e(C, {});
            }
        });

        var A = React.createClass({
            render: function() {
                return e(Provider, { foo: "bar" }, e(B, {}))
            }
        })

        const wrapper = mount(e(A));
        t.equal(wrapper.find("div").text(), "context:bar");
        t.end();
    })

    test('props override context', t => {
        var C = inject("foo")(React.createClass({
            render: function() {
                return e("div", {}, "context:" + this.props.foo);
            }
        }));

        var B = React.createClass({
            render: function() {
                return e(C, { foo: 42 });
            }
        });

        var A = React.createClass({
            render: function() {
                return e(Provider, { foo: "bar" }, e(B, {}))
            }
        })

        const wrapper = mount(e(A));
        t.equal(wrapper.find("div").text(), "context:42");
        t.end();
    })


    test('overriding stores is supported', t => {
        var C = inject("foo", "bar")(observer(React.createClass({
            render: function() {
                return e("div", {}, "context:" + this.props.foo + this.props.bar);
            }
        })));

        var B = React.createClass({
            render: function() {
                return e(C, {});
            }
        });

        var A = React.createClass({
            render: function() {
                return e(Provider, { foo: "bar", bar: 1337 },
                    e("div", {},
                        e("span", {},
                            e(B, {})
                        ),
                        e("section", {},
                            e(Provider, { foo: 42}, e(B, {}))
                        )
                    )
                );
            }
        })

        const wrapper = mount(e(A));
        t.equal(wrapper.find("span").text(), "context:bar1337");
        t.equal(wrapper.find("section").text(), "context:421337");
        t.end();
    })

    test('store should be available', t => {
        var C = inject("foo")(observer(React.createClass({
            render: function() {
                return e("div", {}, "context:" + this.props.foo);
            }
        })));

        var B = React.createClass({
            render: function() {
                return e(C, {});
            }
        });

        var A = React.createClass({
            render: function() {
                return e(Provider, { baz: 42 }, e(B, {}));
            }
        })

        t.throws(() => mount(e(A)), /Store 'foo' is not available! Make sure it is provided by some Provider/);
        t.end();
    })

    test('store is not required if prop is available', t => {
        var C = inject("foo")(observer(React.createClass({
            render: function() {
                return e("div", {}, "context:" + this.props.foo);
            }
        })));

        var B = React.createClass({
            render: function() {
                return e(C, { foo: "bar" });
            }
        });

        const wrapper = mount(e(B));
        t.equal(wrapper.find("div").text(), "context:bar");
        t.end();
    })

    test('inject merges (and overrides) props', t => {
        t.plan(1);
        var C = inject(function() {
            return { a: 1 }
        })(observer(React.createClass({
            render: function() {
                t.deepEqual(this.props, { a: 1, b: 2 });
                return null;
            }
        })));

        var B = React.createClass({
            render: function() {
                return e(C, { a: 2, b: 2 });
            }
        });

        const wrapper = mount(e(B));
    })

    test('warning is printed when changing stores', t => {
        var msg;
        var baseWarn = console.warn;
        console.warn = (m) => msg = m;

        var a = mobx.observable(3);

        var C = observer(["foo"], React.createClass({
            render: function() {
                return e("div", {}, "context:" + this.props.foo);
            }
        }));

        var B = observer(React.createClass({
            render: function() {
                return e(C, {});
            }
        }));

        var A = observer(React.createClass({
            render: function() {
                return e("section", {},
                    e("span", {}, a.get()),
                    e(Provider, { foo: a.get() }, e(B, {}))
                );
            }
        }))

        const wrapper = mount(e(A));
        t.equal(wrapper.find("span").text(), "3");
        t.equal(wrapper.find("div").text(), "context:3");

        a.set(42);

        t.equal(wrapper.find("span").text(), "42");
        t.equal(wrapper.find("div").text(), "context:3");

        t.equal(msg, "MobX Provider: Provided store \'foo\' has changed. Please avoid replacing stores as the change might not propagate to all children");

        console.warn = baseWarn;
        t.end();
    })

    test('custom storesToProps', t => {
        var C = inject(
            function(stores, props, context) {
                t.deepEqual(context, { mobxStores: { foo: "bar" }});
                t.deepEqual(stores, { foo: "bar" });
                t.deepEqual(props, { baz: 42 });
                return {
                    zoom: stores.foo,
                    baz: props.baz * 2
                }
            }
        )(observer(React.createClass({
            render: function() {
                return e("div", {}, "context:" + this.props.zoom + this.props.baz);
            }
        })));

        var B = React.createClass({
            render: function() {
                return e(C, { baz: 42 });
            }
        });

        var A = React.createClass({
            render: function() {
                return e(Provider, { foo: "bar" }, e(B, {}))
            }
        })

        const wrapper = mount(e(A));
        t.equal(wrapper.find("div").text(), "context:bar84");
        t.end();
    })

    test('support static hoisting, wrappedComponent and wrappedInstance', t=> {
        var B = React.createClass({
            render() {
                this.testField = 1;
                return null;
            },
            propTypes: {
                "x": React.PropTypes.object
            }
        })
        B.bla = 17;
        B.bla2 = {};

        var C = inject("booh")(B);
        t.equal(C.wrappedComponent, B);
        t.equal(B.bla, 17);
        t.equal(C.bla, 17);
        t.ok(C.bla2 === B.bla2);
        t.deepEqual(Object.keys(C.wrappedComponent.propTypes), ["x"]);

        const wrapper = mount(e(C, { booh: 42 }));
        t.equal(wrapper.root.nodes[0].wrappedInstance.testField, 1);

        t.end();
    })

    test('warning is printed when attaching contextTypes to HOC', t => {
        var msg = [];
        var baseWarn = console.warn;
        console.warn = (m) => msg.push(m);

        var C = inject(["foo"])(React.createClass({
            displayName: 'C',
            render: function() {
                return e("div", {}, "context:" + this.props.foo);
            }
        }));

        C.contextTypes = {};

        var B = React.createClass({
            render: function() {
                return e(C, {});
            }
        });

        var A = React.createClass({
            render: function() {
                return e(Provider, { foo: "bar" }, e(B, {}))
            }
        })

        const wrapper = mount(e(A));
        t.equal(msg.length, 1);
        t.equal(msg[0], "Mobx Injector: you are trying to attach `contextTypes` on an component decorated with `inject` (or `observer`) HOC. Please specify the contextTypes on the wrapped component instead. It is accessible through the `wrappedComponent`");

        console.warn = baseWarn;
        t.end();
    })


    test('propTypes and defaultProps are forwarded', t => {
        var msg = [];
        var baseError = console.error;
        console.error = (m) => msg.push(m);

        var C = inject(["foo"])(React.createClass({
            displayName: 'C',
            render: function() {
                t.equal(this.props.y, 3);
                t.equal(this.props.x, undefined);
                return null;
            }
        }));

        C.propTypes = {
            x: React.PropTypes.func.isRequired,
            z: React.PropTypes.string.isRequired,
        };
        C.wrappedComponent.propTypes = {
            a: React.PropTypes.func.isRequired,
        };
        C.defaultProps = {
            y: 3
        };

        var B = React.createClass({
            render: function() {
                return e(C, { z: "test" });
            }
        });

        var A = React.createClass({
            render: function() {
                return e(Provider, { foo: "bar" }, e(B, {}))
            }
        })

        const wrapper = mount(e(A));
        t.equal(msg.length, 2);
        t.equal(msg[0].split("\n")[0], 'Warning: Failed prop type: Required prop `x` was not specified in `MobXStoreInjector`.');
        t.equal(msg[1].split("\n")[0], 'Warning: Failed prop type: Required prop `a` was not specified in `C`.');

        console.error = baseError;
        t.end();
    })


   test('warning is not printed when attaching propTypes to injected component', t => {
        var msg = [];
        var baseWarn = console.warn;
        console.warn = (m) => msg = m;

        var C = inject(["foo"])(React.createClass({
            displayName: 'C',
            render: function() {
                return e("div", {}, "context:" + this.props.foo);
            }
        }));

        C.propTypes = {};

        t.equal(msg.length, 0);
        console.warn = baseWarn;
        t.end();
    })

   test('warning is not printed when attaching propTypes to wrappedComponent', t => {
        var msg = [];
        var baseWarn = console.warn;
        console.warn = (m) => msg = m;

        var C = inject(["foo"])(React.createClass({
            displayName: 'C',
            render: function() {
                return e("div", {}, "context:" + this.props.foo);
            }
        }));

        C.wrappedComponent.propTypes = {};

        t.equal(msg.length, 0);
        console.warn = baseWarn;
        t.end();
    })

    test('using a custom injector is reactive', t => {
        const user = mobx.observable({ name: "Noa"})
        const mapper = (stores) => ({ name: stores.user.name })

        const DisplayName = (props) => e("h1", {}, props.name)
        const User = inject(mapper)(DisplayName)
        const App = () => e(Provider, { user: user }, e(User, {}))

        const wrapper = mount(e(App))
        t.equal(wrapper.find("h1").text(), "Noa")

        user.name = "Veria"
        t.equal(wrapper.find("h1").text(), "Veria")
        t.end()
    })

    t.end()
})